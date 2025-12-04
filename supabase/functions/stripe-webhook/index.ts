import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Server-side secret config (set in Supabase edge function environment)
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) {
      return new Response("Stripe not configured", { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-11-20.acacia" });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response("Webhook signature verification failed", { status: 400 });
      }
    } else {
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        let customer = null;
        if (session.customer_details?.email) {
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("*")
            .eq("email", session.customer_details.email)
            .maybeSingle();

          if (existingCustomer) {
            customer = existingCustomer;
          } else {
            const { data: newCustomer } = await supabase
              .from("customers")
              .insert({
                email: session.customer_details.email,
                name: session.customer_details.name || "",
                stripe_customer_id: session.customer as string || null,
              })
              .select()
              .single();

            customer = newCustomer;
          }
        }

        const { data: order } = await supabase
          .from("orders")
          .insert({
            stripe_session_id: session.id,
            customer_id: customer?.id || null,
            total_amount: session.amount_total || 0,
            currency: session.currency || "usd",
            status: "completed",
          })
          .select()
          .single();

        if (order && session.line_items) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

          for (const item of lineItems.data) {
            if (item.price?.product) {
              const productId = typeof item.price.product === "string"
                ? item.price.product
                : item.price.product.id;

              const { data: product } = await supabase
                .from("products")
                .select("*")
                .eq("stripe_product_id", productId)
                .maybeSingle();

              const { data: price } = await supabase
                .from("prices")
                .select("*")
                .eq("stripe_price_id", item.price.id)
                .maybeSingle();

              if (product && price) {
                await supabase
                  .from("order_items")
                  .insert({
                    order_id: order.id,
                    product_id: product.id,
                    price_id: price.id,
                    quantity: item.quantity || 1,
                    unit_amount: item.price.unit_amount || 0,
                  });

                if (product.oneoff) {
                  await supabase
                    .from("products")
                    .update({
                      is_sold: true,
                      reserved_by_session_id: null,
                      reserved_until: null,
                    })
                    .eq("id", product.id);
                }
              }
            }
          }
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const artistEmail = Deno.env.get("ARTIST_EMAIL");

        if (resendApiKey && customer?.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "noreply@yourdomain.com",
              to: customer.email,
              subject: "Order Confirmation",
              html: `
                <h2>Thank you for your order!</h2>
                <p>Your order has been confirmed.</p>
                <p>Order total: $${((session.amount_total || 0) / 100).toFixed(2)}</p>
              `,
            }),
          });

          if (artistEmail) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "noreply@yourdomain.com",
                to: artistEmail,
                subject: "New Order Received",
                html: `
                  <h2>New Order</h2>
                  <p>Customer: ${customer.name} (${customer.email})</p>
                  <p>Total: $${((session.amount_total || 0) / 100).toFixed(2)}</p>
                `,
              }),
            });
          }
        }

        break;
      }

      case "product.created":
      case "product.updated": {
        const product = event.data.object as Stripe.Product;

        const { data: existing } = await supabase
          .from("products")
          .select("*")
          .eq("stripe_product_id", product.id)
          .maybeSingle();

        const productData = {
          stripe_product_id: product.id,
          name: product.name,
          description: product.description || "",
          image_url: product.images?.[0] || "",
          thumbnail_url: product.images?.[0] || "",
          type: product.metadata?.type || "",
          collection: product.metadata?.collection || "",
          oneoff: product.metadata?.oneoff === "true",
          visible: product.active,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase
            .from("products")
            .update(productData)
            .eq("id", existing.id);
        } else {
          await supabase
            .from("products")
            .insert(productData);
        }

        break;
      }

      case "product.deleted": {
        const product = event.data.object as Stripe.Product;

        await supabase
          .from("products")
          .update({ visible: false })
          .eq("stripe_product_id", product.id);

        break;
      }

      case "price.created":
      case "price.updated": {
        const price = event.data.object as Stripe.Price;

        const productId = typeof price.product === "string"
          ? price.product
          : price.product.id;

        const { data: product } = await supabase
          .from("products")
          .select("*")
          .eq("stripe_product_id", productId)
          .maybeSingle();

        if (product) {
          const { data: existing } = await supabase
            .from("prices")
            .select("*")
            .eq("stripe_price_id", price.id)
            .maybeSingle();

          const priceData = {
            stripe_price_id: price.id,
            product_id: product.id,
            unit_amount: price.unit_amount || 0,
            currency: price.currency,
            updated_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase
              .from("prices")
              .update(priceData)
              .eq("id", existing.id);
          } else {
            await supabase
              .from("prices")
              .insert(priceData);
          }
        }

        break;
      }

      case "price.deleted": {
        const price = event.data.object as Stripe.Price;

        await supabase
          .from("prices")
          .delete()
          .eq("stripe_price_id", price.id);

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
