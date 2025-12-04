import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CartValidationItem {
  stripeProductId: string;
  quantity: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { items } = await req.json() as { items: CartValidationItem[] };

    // Server-side secret config (set in Supabase edge function environment)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const availableItems: CartValidationItem[] = [];
    const unavailableItems: Array<{ stripeProductId: string; reason: string }> = [];

    for (const item of items) {
      const { data: product, error } = await supabase
        .from("products")
        .select("*")
        .eq("stripe_product_id", item.stripeProductId)
        .single();

      if (error || !product) {
        unavailableItems.push({
          stripeProductId: item.stripeProductId,
          reason: "Product not found",
        });
        continue;
      }

      if (product.is_sold) {
        unavailableItems.push({
          stripeProductId: item.stripeProductId,
          reason: "Product has been sold",
        });
        continue;
      }

      if (!product.visible) {
        unavailableItems.push({
          stripeProductId: item.stripeProductId,
          reason: "Product is no longer available",
        });
        continue;
      }

      if (product.reserved_until) {
        const reservedUntil = new Date(product.reserved_until);
        const now = new Date();

        if (reservedUntil > now) {
          unavailableItems.push({
            stripeProductId: item.stripeProductId,
            reason: "Product is currently reserved",
          });
          continue;
        }
      }

      availableItems.push(item);
    }

    return new Response(
      JSON.stringify({ availableItems, unavailableItems }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error validating cart:", error);
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
