#!/usr/bin/env python3
"""
POTENT Bodega V1 catalog generator.

Reads the read-only Shopify backup, keeps ACTIVE products (excluding the
"gallery-page" $0.00 gallery container), optimizes up to 6 images per
product into bodega/img/<handle>/<i>.jpg, and writes:
  - bodega/catalog.json         (JSON array, indent 1)
  - bodega/server-catalog.json  ({handle: {title, priceCents, floorCents}})

No placeholders, no fake images, no external URLs in the catalog.
"""
import html
import json
import re
import sys
from pathlib import Path

from PIL import Image

# --- Config (step 2 of the build: drop to 900 / 78 if img total > 120 MB) ---
MAX_DIM = 1000
JPEG_QUALITY = 82
MAX_IMAGES_PER_PRODUCT = 6
DESCRIPTION_MAX_CHARS = 700

BODEGA_DIR = Path(__file__).resolve().parent
SOURCE_DIR = (
    Path.home()
    / "workspace/goals/bodega-build-storefront/hidden_files/shopify-backup-2026-10-22"
)
PRODUCTS_FILE = SOURCE_DIR / "products-all.json"
GRAPHQL_FILE = SOURCE_DIR / "graphql-products-all.json"
DOWNLOAD_LIST_FILE = SOURCE_DIR / "image-download-list.txt"
SOURCE_IMAGES_DIR = SOURCE_DIR / "images"

CATALOG_FILE = BODEGA_DIR / "catalog.json"
SERVER_CATALOG_FILE = BODEGA_DIR / "server-catalog.json"
IMG_OUT_DIR = BODEGA_DIR / "img"

EXCLUDED_HANDLES = {"gallery-page"}

# MULTICITY × POTENT Mystery Box Collection (owner spec, Oct 24 2026). Boxes are not
# Shopify products: they are appended after the product loop so regeneration keeps them.
# The server-side source of truth for box definitions is
# netlify/functions/lib/bodega-boxes.js — keep the two in sync. Boxes have no photos
# (images: [] renders the POTENT placeholder) and effectively unlimited stock (they are
# fulfilled by hand from catalog stock), so they never read as sold out.
BOXES = [
    {
        "handle": "mystery-box-platinum",
        "title": "MULTICITY × POTENT Mystery Box — Platinum",
        "price": 299.0,
        "description": "The entry-level MULTICITY collectible clothing box. Includes 1 clothing top, 1 clothing bottom and 1 accessory. Every box guarantees at least 2x its purchase price in POTENT retail/MSRP value ($598+). Exact designs and colors vary by box. ALL SALES FINAL.",
    },
    {
        "handle": "mystery-box-diamond",
        "title": "MULTICITY × POTENT Mystery Box — Diamond",
        "price": 499.0,
        "description": "A larger MULTICITY selection with a specialty jersey. Includes 1 clothing top, 1 clothing bottom, 1 specialty jersey and 2 accessories. Every box guarantees at least 2x its purchase price in POTENT retail/MSRP value ($998+). Exact designs and colors vary by box. ALL SALES FINAL.",
    },
    {
        "handle": "mystery-box-vault",
        "title": "MULTICITY × POTENT Mystery Box — POTENT'S PICK (The Vault)",
        "price": 899.0,
        "description": "POTENT'S PICK — The Vault. Includes 2 complete outfits (2 tops and 2 bottoms), 3 accessories and 1 collectible, plus a chance of a special Vault Hit: a rare 1-of-1 accessory, archived design, numbered piece, special jersey, exclusive colorway, early release, or signed/numbered collectible. Vault Hits are possible bonus finds, never guaranteed. Every box guarantees at least 2x its purchase price in POTENT retail/MSRP value ($1,798+). Exact designs and colors vary by box. ALL SALES FINAL.",
    },
    {
        "handle": "mystery-box-black-label",
        "title": "MULTICITY × POTENT Mystery Box — Black Label",
        "price": 1499.0,
        "description": "The highest-tier curated MULTICITY experience. Includes 2 premium outfits, 1 specialty or limited-edition jersey, 4 accessories, 1 premium collectible, a numbered certificate, premium packaging and a personal styling selection. Every box guarantees at least 2x its purchase price in POTENT retail/MSRP value ($2,998+). Exact designs and colors vary by box. ALL SALES FINAL.",
    },
]


def clean_description(raw):
    """Strip HTML tags, unescape entities, collapse whitespace, cap length."""
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", str(raw))
    text = html.unescape(text)
    text = " ".join(text.split())
    return text[:DESCRIPTION_MAX_CHARS]


def walk_product_objects(node, found):
    """Recursively find product objects: dicts with handle+title+images."""
    if isinstance(node, dict):
        if "handle" in node and "title" in node and "images" in node:
            handle = node.get("handle")
            if handle and handle not in found:
                urls = []
                images = node.get("images") or {}
                if isinstance(images, dict):
                    for edge in images.get("edges") or []:
                        if isinstance(edge, dict):
                            n = edge.get("node") or {}
                            url = n.get("url")
                            if url:
                                urls.append(url)
                found[handle] = urls
        for value in node.values():
            walk_product_objects(value, found)
    elif isinstance(node, list):
        for item in node:
            walk_product_objects(item, found)


def load_graphql_image_urls():
    with open(GRAPHQL_FILE, encoding="utf-8") as f:
        data = json.load(f)
    found = {}
    walk_product_objects(data, found)
    return found


def load_download_map():
    mapping = {}
    with open(DOWNLOAD_LIST_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or "\t" not in line:
                continue
            url, filename = line.split("\t", 1)
            url = url.strip()
            filename = filename.strip()
            if url and filename and url not in mapping:
                mapping[url] = SOURCE_IMAGES_DIR / filename
    return mapping


def featured_url(product):
    try:
        return product["featuredMedia"]["preview"]["image"]["url"]
    except Exception:
        return None


def optimize_image(src_path, dest_path):
    """Open with PIL, flatten alpha on white, thumbnail, save JPEG.

    Returns True on success, False on any failure (caller skips silently).
    Never upscales: PIL thumbnail() only shrinks.
    """
    try:
        with Image.open(src_path) as im:
            im.load()
            # Flatten alpha onto white, then convert to RGB.
            if im.mode in ("RGBA", "LA") or (
                im.mode == "P" and "transparency" in im.info
            ):
                rgba = im.convert("RGBA")
                background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                flattened = Image.alpha_composite(background, rgba)
                rgb = flattened.convert("RGB")
            else:
                rgb = im.convert("RGB")
            rgb.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            rgb.save(dest_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
        return True
    except Exception:
        return False


def main():
    with open(PRODUCTS_FILE, encoding="utf-8") as f:
        products = json.load(f)

    kept = [
        p
        for p in products
        if p.get("status") == "ACTIVE" and p.get("handle") not in EXCLUDED_HANDLES
    ]
    print(f"Products kept (ACTIVE, excluding gallery-page): {len(kept)}")

    graphql_images = load_graphql_image_urls()
    download_map = load_download_map()

    catalog = []
    server_catalog = {}
    zero_image_products = []
    total_images = 0

    for product in kept:
        handle = product.get("handle") or ""
        title = product.get("title") or ""

        try:
            price = float(
                (product.get("priceRangeV2") or {}).get("minVariantPrice", {}).get("amount")
            )
        except Exception:
            price = 0.0

        variant_inventory = 0
        try:
            edges = (product.get("variants") or {}).get("edges") or []
            for edge in edges:
                node = (edge or {}).get("node") or {}
                qty = node.get("inventoryQuantity")
                if isinstance(qty, (int, float)):
                    variant_inventory += int(qty)
        except Exception:
            variant_inventory = 0
        variant_inventory = max(0, variant_inventory)

        try:
            total_inventory = int(product.get("totalInventory") or 0)
        except Exception:
            total_inventory = 0

        # Ordered URLs: featured first, then graphql images in order, deduped.
        ordered_urls = []
        seen = set()
        feat = featured_url(product)
        candidates = []
        if feat:
            candidates.append(feat)
        candidates.extend(graphql_images.get(handle, []))
        for url in candidates:
            if url and url not in seen:
                seen.add(url)
                ordered_urls.append(url)
        ordered_urls = ordered_urls[:MAX_IMAGES_PER_PRODUCT]

        image_paths = []
        out_index = 0
        for url in ordered_urls:
            local_file = download_map.get(url)
            if local_file is None or not local_file.is_file():
                continue
            dest = IMG_OUT_DIR / handle / f"{out_index}.jpg"
            if optimize_image(local_file, dest):
                image_paths.append(f"img/{handle}/{out_index}.jpg")
                out_index += 1
            # failures are skipped silently per spec

        if not image_paths:
            zero_image_products.append(handle)

        total_images += len(image_paths)

        catalog.append(
            {
                "handle": handle,
                "title": title,
                "description": clean_description(product.get("description")),
                "price": price,
                "tags": list(product.get("tags") or []),
                "productType": product.get("productType") or "",
                "totalInventory": total_inventory,
                "variantInventory": variant_inventory,
                "resaleFloor": price,
                "creator": "POTENT",
                "images": image_paths,
            }
        )

        price_cents = round(price * 100)
        server_catalog[handle] = {
            "title": title,
            "priceCents": price_cents,
            "floorCents": price_cents,
        }

    # Mystery boxes (see BOXES above): appended to both catalogs, never sold out.
    for box in BOXES:
        if box["handle"] in server_catalog:
            continue
        price_cents = round(box["price"] * 100)
        catalog.append(
            {
                "handle": box["handle"],
                "title": box["title"],
                "description": box["description"],
                "price": box["price"],
                "tags": ["Mystery Box", "MULTICITY"],
                "productType": "Mystery Box",
                "totalInventory": 999,
                "variantInventory": 999,
                "resaleFloor": box["price"],
                "creator": "POTENT",
                "images": [],
            }
        )
        server_catalog[box["handle"]] = {
            "title": box["title"],
            "priceCents": price_cents,
            "floorCents": price_cents,
        }
    print(f"Mystery boxes appended: {len(BOXES)}")

    CATALOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=1, ensure_ascii=False)

    with open(SERVER_CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(server_catalog, f, indent=1, ensure_ascii=False)

    # The Netlify functions load their price map from a copy inside netlify/functions/lib/
    # (files outside the functions folder are not bundled). Keep that copy in sync.
    lib_copy = BODEGA_DIR.parent / "netlify" / "functions" / "lib" / "bodega-server-catalog.json"
    try:
        lib_copy.parent.mkdir(parents=True, exist_ok=True)
        with open(lib_copy, "w", encoding="utf-8") as f:
            json.dump(server_catalog, f, indent=1, ensure_ascii=False)
    except OSError:
        pass

    total_bytes = 0
    if IMG_OUT_DIR.is_dir():
        for p in IMG_OUT_DIR.rglob("*"):
            if p.is_file():
                total_bytes += p.stat().st_size
    total_mb = total_bytes / (1024 * 1024)

    print(f"Products written: {len(catalog)}")
    print(f"Products with 0 images: {len(zero_image_products)}")
    if zero_image_products:
        print("Zero-image handles: " + ", ".join(zero_image_products))
    print(f"Total images written: {total_images}")
    print(f"Total MB of bodega/img: {total_mb:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
