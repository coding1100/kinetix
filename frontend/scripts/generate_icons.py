import os
from PIL import Image, ImageDraw, ImageFont

def create_kinetix_icon():
    icons_dir = r"c:\Users\hamza\Desktop\kinetix\frontend\src-tauri\icons"
    os.makedirs(icons_dir, exist_ok=True)
    
    # Create base 512x512 image with a stylish purple/indigo gradient-style background
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle background
    draw.rounded_rectangle([16, 16, size - 16, size - 16], radius=96, fill=(79, 70, 229, 255)) # Indigo-600
    
    # Draw inner K stylized shape (white/cyan)
    # Vertical stem
    draw.rounded_rectangle([120, 100, 180, 412], radius=16, fill=(255, 255, 255, 255))
    # Top diagonal
    draw.polygon([(180, 240), (330, 110), (390, 160), (240, 280)], fill=(255, 255, 255, 255))
    # Bottom diagonal
    draw.polygon([(230, 260), (370, 390), (310, 420), (180, 300)], fill=(129, 140, 248, 255))

    # Save PNG variations
    sizes_map = {
        "32x32.png": (32, 32),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "Square30x30Logo.png": (30, 30),
        "Square44x44Logo.png": (44, 44),
        "Square71x71Logo.png": (71, 71),
        "Square89x89Logo.png": (89, 89),
        "Square107x107Logo.png": (107, 107),
        "Square142x142Logo.png": (142, 142),
        "Square150x150Logo.png": (150, 150),
        "Square284x284Logo.png": (284, 284),
        "Square310x310Logo.png": (310, 310),
        "StoreLogo.png": (50, 50),
        "icon.png": (512, 512),
    }

    for filename, dimensions in sizes_map.items():
        resized = img.resize(dimensions, Image.Resampling.LANCZOS)
        resized.save(os.path.join(icons_dir, filename))
        
    # Save Windows ICO file (containing 16, 32, 48, 64, 128, 256 sizes)
    img.save(os.path.join(icons_dir, "icon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    
    # Save dummy icns file if needed
    img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(icons_dir, "icon.icns"))

    print(f"Generated all icons successfully in {icons_dir}")

if __name__ == "__main__":
    create_kinetix_icon()
