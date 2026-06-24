"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/data";

/**
 * Size selection + checkout hand-off. The catalog lives here, but cart and
 * checkout happen on Shopify — the button deep-links to the product there.
 */
export function ProductPurchase({ product }: { product: Product }) {
  const hasSizes = !!product.sizes?.length;
  const singleSize = product.sizes?.length === 1;
  const [size, setSize] = useState<string | null>(singleSize ? product.sizes![0] : null);

  function checkout() {
    if (hasSizes && !singleSize && !size) {
      toast.error("Pick a size first.");
      return;
    }
    // Hand off to Shopify for cart + payment.
    const url = size
      ? `${product.shopifyUrl}?variant=${encodeURIComponent(size)}`
      : product.shopifyUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      {hasSizes && !singleSize && (
        <div>
          <p className="mb-2 text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
            Size
          </p>
          <div className="flex flex-wrap gap-2">
            {product.sizes!.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={cn(
                  "min-w-11 rounded-pill border-[1.5px] px-4 py-2 text-sm font-medium [letter-spacing:var(--tv-track-tight)] transition-colors",
                  size === s
                    ? "border-black bg-black text-white"
                    : "border-gray-300 text-gray-700 hover:border-black hover:text-black",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="inverse"
        size="lg"
        fullWidth
        onClick={checkout}
        iconLeft={<ShoppingBag size={18} />}
      >
        Buy on Shopify
      </Button>
      <p className="text-center text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
        Secure checkout is handled by Shopify.
      </p>
    </div>
  );
}
