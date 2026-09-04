import cv2
import os


def calculate_blur_score(image):
    """
    Calculate sharpness using the variance of the Laplacian.
    Higher value generally means more detail/sharpness.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def calculate_brightness(image):
    """
    Calculate average brightness of an image.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return float(gray.mean())


def detect_product_region(image):
    """
    Try to find the main bright/product region in the image.

    This is useful when the product is photographed against a
    dark background. We don't want the dark background to make
    the whole image look like a bad photo.
    """

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Slight blur helps remove tiny noise before thresholding.
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Find brighter areas.
    _, threshold = cv2.threshold(
        blurred,
        70,
        255,
        cv2.THRESH_BINARY
    )

    # Join nearby bright regions.
    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (15, 15)
    )

    threshold = cv2.morphologyEx(
        threshold,
        cv2.MORPH_CLOSE,
        kernel
    )

    threshold = cv2.morphologyEx(
        threshold,
        cv2.MORPH_OPEN,
        kernel
    )

    contours, _ = cv2.findContours(
        threshold,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return None

    image_height, image_width = gray.shape

    image_area = image_width * image_height

    candidates = []

    for contour in contours:

        x, y, w, h = cv2.boundingRect(contour)

        area = w * h

        # Ignore very small objects/noise.
        if area < image_area * 0.02:
            continue

        # Product packages are usually reasonably large.
        if w < image_width * 0.15 or h < image_height * 0.15:
            continue

        candidates.append(
            (
                area,
                x,
                y,
                w,
                h
            )
        )

    if not candidates:
        return None

    # Select the largest useful bright region.
    candidates.sort(
        key=lambda item: item[0],
        reverse=True
    )

    _, x, y, w, h = candidates[0]

    # Add some padding around the detected package.
    padding_x = int(w * 0.08)
    padding_y = int(h * 0.08)

    x1 = max(0, x - padding_x)
    y1 = max(0, y - padding_y)

    x2 = min(image_width, x + w + padding_x)
    y2 = min(image_height, y + h + padding_y)

    return {
        "x": x1,
        "y": y1,
        "width": x2 - x1,
        "height": y2 - y1
    }


def crop_product_region(image, region):
    """
    Crop the detected product region.
    """

    if region is None:
        return image

    x = region["x"]
    y = region["y"]
    width = region["width"]
    height = region["height"]

    return image[
        y:y + height,
        x:x + width
    ]


def get_retake_instructions(reasons):
    """
    Convert technical image-quality problems into
    simple instructions that can be shown directly
    to the user.
    """

    instructions = []

    for reason in reasons:

        if "blurry" in reason.lower():

            instructions.append(
                "Hold your phone steady and make sure the text is clear."
            )

        elif "dark" in reason.lower():

            instructions.append(
                "Take the photo in better lighting and avoid dark shadows."
            )

        elif "overexposed" in reason.lower():

            instructions.append(
                "Avoid strong light or glare on the package."
            )

        elif "excessive brightness" in reason.lower():

            instructions.append(
                "Avoid direct light and reflections on the package."
            )

        elif "too little" in reason.lower():

            instructions.append(
                "Move closer so the package fills most of the screen."
            )

        elif "resolution" in reason.lower():

            instructions.append(
                "Use a clearer, higher-quality photo."
            )

        elif "could not be detected" in reason.lower():

            instructions.append(
                "Make sure the whole package is clearly visible."
            )

    # Remove duplicate instructions while keeping order.
    unique_instructions = []

    for instruction in instructions:

        if instruction not in unique_instructions:
            unique_instructions.append(instruction)

    # Always provide a useful fallback.
    if not unique_instructions:

        unique_instructions = [
            "Take a clear photo of the product.",
            "Make sure the package fills most of the screen.",
            "Use good lighting and keep the phone steady."
        ]

    return unique_instructions


def analyze_image_quality(image_path):
    """
    Analyze whether an uploaded product image is good enough
    for product inspection.

    If the image is not suitable, the system returns
    RETAKE_REQUIRED along with simple instructions for the user.
    """

    # ---------------------------------------------------------
    # STEP 0: Check whether the image exists
    # ---------------------------------------------------------

    if not os.path.exists(image_path):

        return {
            "status": "RETAKE_REQUIRED",
            "score": 0,
            "message": "We could not find the image.",
            "retake_reason": [
                "Image file is missing."
            ],
            "retake_instructions": [
                "Please take a new photo of the product."
            ]
        }

    # ---------------------------------------------------------
    # STEP 1: Read the image
    # ---------------------------------------------------------

    image = cv2.imread(image_path)

    if image is None:

        return {
            "status": "RETAKE_REQUIRED",
            "score": 0,
            "message": "We could not read this photo.",
            "retake_reason": [
                "Invalid or unreadable image."
            ],
            "retake_instructions": [
                "Please take a new photo of the product."
            ]
        }

    height, width = image.shape[:2]

    # ---------------------------------------------------------
    # STEP 2: Detect the product/package region
    # ---------------------------------------------------------

    product_region = detect_product_region(image)

    product_image = crop_product_region(
        image,
        product_region
    )

    # ---------------------------------------------------------
    # STEP 3: Measure image quality
    # ---------------------------------------------------------

    blur_score = calculate_blur_score(product_image)
    brightness = calculate_brightness(product_image)

    reasons = []

    score = 100

    # ---------------------------------------------------------
    # STEP 4: Resolution / product-size check
    # ---------------------------------------------------------

    if product_region is not None:

        product_width = product_region["width"]
        product_height = product_region["height"]

        # Judge the resolution of the product itself,
        # not the entire photograph.
        if product_width < 400 or product_height < 400:

            score -= 25

            reasons.append(
                "The product occupies too little of the image."
            )

    else:

        # If product detection fails, use the full image
        # as a fallback.
        if width < 700 or height < 700:

            score -= 15

            reasons.append(
                "Image resolution may be too low."
            )

    # ---------------------------------------------------------
    # STEP 5: Blur check
    # ---------------------------------------------------------

    if blur_score < 40:

        score -= 40

        reasons.append(
            "The product image is too blurry."
        )

    elif blur_score < 80:

        score -= 20

        reasons.append(
            "The product image may be slightly blurry."
        )

    # ---------------------------------------------------------
    # STEP 6: Brightness check
    # ---------------------------------------------------------

    # Brightness is calculated from the product region.
    # Therefore, a dark background should not cause
    # RETAKE_REQUIRED if the package itself is visible.

    if brightness < 45:

        score -= 30

        reasons.append(
            "The product is too dark."
        )

    elif brightness < 65:

        score -= 15

        reasons.append(
            "The product may be slightly dark."
        )

    elif brightness > 240:

        score -= 30

        reasons.append(
            "The product is overexposed."
        )

    elif brightness > 225:

        score -= 15

        reasons.append(
            "The product may be affected by excessive brightness."
        )

    # ---------------------------------------------------------
    # STEP 7: Final score
    # ---------------------------------------------------------

    score = max(
        0,
        min(100, score)
    )

    # ---------------------------------------------------------
    # STEP 8: Decide whether retake is required
    # ---------------------------------------------------------

    if score < 60:

        status = "RETAKE_REQUIRED"

        message = (
            "This photo is not clear enough for reliable inspection."
        )

        retake_instructions = get_retake_instructions(
            reasons
        )

    else:

        status = "GOOD"

        message = (
            "Image quality is sufficient for product inspection."
        )

        retake_instructions = []

    # ---------------------------------------------------------
    # STEP 9: Return result
    # ---------------------------------------------------------

    result = {
        "status": status,
        "score": score,
        "blur_score": round(blur_score, 2),
        "brightness": round(brightness, 2),
        "resolution": {
            "width": width,
            "height": height
        },
        "message": message,
        "retake_reason": reasons,
        "retake_instructions": retake_instructions
    }

    # ---------------------------------------------------------
    # STEP 10: Include detected product region
    # ---------------------------------------------------------

    if product_region is not None:

        result["product_region"] = product_region

        result["quality_scope"] = (
            "Quality was primarily evaluated on the detected "
            "product/package region."
        )

    else:

        result["product_region"] = None

        result["quality_scope"] = (
            "Product region could not be detected, so the "
            "full image was used as a fallback."
        )

    return result