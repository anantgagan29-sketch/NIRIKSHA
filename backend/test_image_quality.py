import cv2
import shutil
from app.services.image_quality_service import analyze_image_quality


# Your current test image
IMAGE_PATH = "test_product.jpg"


# -----------------------------------------
# Check that the original image exists
# -----------------------------------------

image = cv2.imread(IMAGE_PATH)

if image is None:
    print("ERROR: Could not find:")
    print(IMAGE_PATH)
    print("\nMake sure test_product.jpg is inside the backend folder.")
    exit()


# -----------------------------------------
# Create artificial test images
# -----------------------------------------

# 1. Blurry image
blurry_image = cv2.GaussianBlur(image, (51, 51), 0)
cv2.imwrite("test_blurry.jpg", blurry_image)


# 2. Dark image
dark_image = cv2.convertScaleAbs(
    image,
    alpha=0.35,
    beta=0
)
cv2.imwrite("test_dark.jpg", dark_image)


# -----------------------------------------
# Test function
# -----------------------------------------

def test_image(path, name):

    result = analyze_image_quality(path)

    print("\n================================")
    print(name)
    print("================================")

    print("Status:", result["status"])
    print("Score:", result["score"])
    print("Blur score:", result.get("blur_score"))
    print("Brightness:", result.get("brightness"))
    print("Resolution:", result.get("resolution"))

    print("\nMessage:")
    print(result["message"])

    print("\nRetake reasons:")

    if result["retake_reason"]:
        for reason in result["retake_reason"]:
            print("-", reason)
    else:
        print("None")


# -----------------------------------------
# Run tests
# -----------------------------------------

test_image(
    "test_product.jpg",
    "CURRENT PHOTO"
)

test_image(
    "test_blurry.jpg",
    "ARTIFICIALLY BLURRED PHOTO"
)

test_image(
    "test_dark.jpg",
    "ARTIFICIALLY DARK PHOTO"
)


print("\n================================")
print("ALL TESTS COMPLETE")
print("================================")