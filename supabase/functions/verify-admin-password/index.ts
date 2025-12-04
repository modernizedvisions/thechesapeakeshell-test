import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as bcrypt from "npm:bcryptjs@2";

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
    const { password } = await req.json() as { password: string };

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: "Password required" }),
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
    const adminPasswordHash = Deno.env.get("ADMIN_PASSWORD_HASH");

    if (!adminPasswordHash) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin password not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const isValid = await bcrypt.compare(password, adminPasswordHash);

    if (isValid) {
      const token = crypto.randomUUID();

      return new Response(
        JSON.stringify({ success: true, token }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid password" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error verifying password:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
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
