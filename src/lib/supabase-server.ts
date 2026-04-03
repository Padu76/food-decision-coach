import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  const cookieStore = await cookies();
  const cookieStoreAny = cookieStore as any;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          const all = cookieStoreAny.getAll?.();
          return Array.isArray(all) ? all : [];
        },
        setAll: (cookiesToSet: any[]) => {
          (cookiesToSet ?? []).forEach(({ name, value, options }: any) => {
            cookieStoreAny.set?.(name, value, options);
          });
        },
      },
    }
  );
}
