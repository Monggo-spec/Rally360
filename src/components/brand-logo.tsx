import Image from "next/image";
import { BRAND } from "@/lib/brand";

export function BrandLogo({ size = 40, subtitle = "Pickleball Club" }: { size?: number; subtitle?: string | null }) {
  return (
    <span className="brand">
      <Image className="brand-mark" src={BRAND.images.logo} alt="" width={size} height={size} priority />
      <span>
        <span className="brand-name">{BRAND.name}</span>
        {subtitle ? <span className="brand-sub">{subtitle}</span> : null}
      </span>
    </span>
  );
}
