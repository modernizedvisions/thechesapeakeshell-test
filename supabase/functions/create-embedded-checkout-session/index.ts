import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CartItem {
  stripeProductId: string;
  stripePriceId: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
  oneoff: boolean;
}

interface CheckoutRequest {
  items: CartItem[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { items, successUrl, cancelUrl, customerEmail } = await req.json() as CheckoutRequest;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No items in cart" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Server-side secret config (set in Supabase edge function environment)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-11-20.acacia" });

    for (const item of items) {
      const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("stripe_product_id", item.stripeProductId)
        .single();

      if (error || !product || product.is_sold || !product.visible) {
        return new Response(
          JSON.stringify({ error: `Product ${item.name} is no longer available` }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    const sessionId = crypto.randomUUID();
    const reservedUntil = new Date(Date.now() + 10 * 60 * 1000);

    for (const item of items) {
      if (item.oneoff) {
        await supabase
          .from("products")
          .update({
            reserved_by_session_id: sessionId,
            reserved_until: reservedUntil.toISOString(),
          })
          .eq("stripe_product_id", item.stripeProductId);
      }
    }

    const lineItems = items.map(item => ({
      price: item.stripePriceId,
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      line_items: lineItems,
      mode: "payment",
      return_url: successUrl,
      customer_email: customerEmail,
      metadata: {
        reservation_session_id: sessionId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        stripeClientSecret: session.client_secret,
        reservedUntil: reservedUntil.toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
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
