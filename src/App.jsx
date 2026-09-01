import { useState } from "react";
import Tesseract from "tesseract.js";
import "./App.css";
function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showOCR, setShowOCR] = useState(false);

  const [result, setResult] = useState({
    productName: "Not detected",
    ingredients: "Not detected",
    oil: "Not detected",
    allergens: [],
    additives: [],
    licence: "Not detected",
    batch: "Not detected",
    mrp: "Not detected",
    mfg: "Not detected",
    expiry: "Not detected",
    nutrition: [],
  });

  // =====================================================
  // FILE UPLOAD
  // =====================================================

  const handleFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid product image.");
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));

    setText("");
    setError("");
    setProgress(0);
    setShowOCR(false);

    setResult({
      productName: "Not detected",
      ingredients: "Not detected",
      oil: "Not detected",
      allergens: [],
      additives: [],
      licence: "Not detected",
      batch: "Not detected",
      mrp: "Not detected",
      mfg: "Not detected",
      expiry: "Not detected",
      nutrition: [],
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      handleFile(file);
    }
  };

  // =====================================================
  // IMAGE PREPROCESSING
  // =====================================================

   const preprocessImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const url = URL.createObjectURL(file);

      img.onload = () => {
        try {
          const scale = 2;

          const canvas = document.createElement("canvas");

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");

          if (!ctx) {
            throw new Error("Canvas not supported.");
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );
          const runAnalysis = async () => {
  if (!image) {
    setError("Please upload a product image first.");
    return;
  }

  setLoading(true);
  setError("");
  setText("");
  setProgress(0);
  setShowOCR(false);

  try {
    // Step 1: Preprocess image
    const processedImage = await preprocessImage(image);

    // Step 2: Run Tesseract OCR
    const { data } = await Tesseract.recognize(
      processedImage,
      "eng",
      {
        logger: (info) => {
          if (info.status === "recognizing text") {
            setProgress(Math.round(info.progress * 100));
          }
        },
      }
    );

    const ocrText = data.text || "";

    // Step 3: Save OCR text
    setText(ocrText);

    // Step 4: Extract product information
    const detectedProductName =
      findProductName(ocrText);

    const detectedIngredients =
      findIngredients(ocrText);

    const detectedOil =
      findCookingOil(ocrText);

    const detectedAllergens =
      findAllergens(ocrText);

    const detectedAdditives =
      findAdditives(ocrText);

    const detectedLicence =
      findLicence(ocrText);

    const detectedBatch =
      findBatch(ocrText);

    const detectedMRP =
      findMRP(ocrText);

    const detectedMfg =
      findDate(ocrText, "mfg");

    const detectedExpiry =
      findDate(ocrText, "expiry");

    // Step 5: Update result
    setResult({
      productName: detectedProductName,
      ingredients: detectedIngredients,
      oil: detectedOil,
      allergens: detectedAllergens,
      additives: detectedAdditives,
      licence: detectedLicence,
      batch: detectedBatch,
      mrp: detectedMRP,
      mfg: detectedMfg,
      expiry: detectedExpiry,
      nutrition: [],
    });

    setProgress(100);
  } catch (err) {
    console.error("OCR Error:", err);
    setError(
      "OCR analysis failed. Please try another image."
    );
  } finally {
    setLoading(false);
  }
};

          const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );

          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            let gray =
              0.299 * r +
              0.587 * g +
              0.114 * b;

            gray = (gray - 128) * 1.45 + 128;

            gray = Math.max(
              0,
              Math.min(255, gray)
            );

            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }

          ctx.putImageData(imageData, 0, 0);

          const processed = canvas.toDataURL(
            "image/png"
          );

          URL.revokeObjectURL(url);

          resolve(processed);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);

        reject(
          new Error("Could not load image.")
        );
      };

      img.src = url;
    });
  };

  // =====================================================
  // PRODUCT NAME
  // =====================================================

  const findProductName = (ocrText) => {
    const lines = ocrText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const keywords = [
      "namkeen",
      "mixture",
      "bhujia",
      "sev",
      "chips",
      "biscuit",
      "cookies",
      "snacks",
      "noodles",
      "chocolate",
      "soya",
      "soy",
    ];

    for (const line of lines) {
      if (
        keywords.some((word) =>
          line.toLowerCase().includes(word)
        )
      ) {
        return line;
      }
    }

    return lines[0] || "Not detected";
  };

  // =====================================================
  // INGREDIENTS
  // =====================================================

  const findIngredients = (ocrText) => {
    const match = ocrText.match(
      /ingredients?\s*[:.-]?\s*([\s\S]{10,700})/i
    );

    if (!match) {
      return "Not detected";
    }

    const cleaned = match[1]
      .split(
        /nutrition|nutritional information|fssai|licence|license|mrp|batch|mfd|mfg|expiry|best before/i
      )[0]
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || "Not detected";
  };

  // =====================================================
  // COOKING OIL
  // =====================================================

  const findOil = (ocrText) => {
    const lower = ocrText.toLowerCase();

    const oils = [
      ["palm oil", "Palm Oil"],
      ["palmolein", "Palmolein"],
      ["palm olein", "Palm Olein"],
      ["sunflower oil", "Sunflower Oil"],
      ["rice bran oil", "Rice Bran Oil"],
      ["groundnut oil", "Groundnut Oil"],
      ["soybean oil", "Soybean Oil"],
      ["mustard oil", "Mustard Oil"],
      ["vegetable oil", "Vegetable Oil"],
    ];

    for (const [key, value] of oils) {
      if (lower.includes(key)) {
        return value;
      }
    }

    return "Not detected";
  };

  // =====================================================
  // ALLERGENS
  // =====================================================

  const findAllergens = (ocrText) => {
    const lower = ocrText.toLowerCase();

    const rules = [
      ["wheat", "Wheat / Gluten"],
      ["maida", "Wheat / Gluten"],
      ["gluten", "Wheat / Gluten"],
      ["milk", "Milk"],
      ["whey", "Milk"],
      ["casein", "Milk"],
      ["peanut", "Peanut"],
      ["groundnut", "Peanut / Groundnut"],
      ["soy", "Soy"],
      ["soya", "Soya"],
      ["sesame", "Sesame"],
      ["mustard", "Mustard"],
      ["almond", "Tree Nuts"],
      ["cashew", "Tree Nuts"],
      ["walnut", "Tree Nuts"],
      ["pistachio", "Tree Nuts"],
      ["egg", "Egg"],
    ];

    return [
      ...new Set(
        rules
          .filter(([key]) => lower.includes(key))
          .map(([, value]) => value)
      ),
    ];
  };

  // =====================================================
  // ADDITIVES / E NUMBERS
  // =====================================================

  const findAdditives = (ocrText) => {
    const additives = {
      "296": "Malic Acid",
      "330": "Citric Acid",
      "621": "Monosodium Glutamate (MSG)",
      "627": "Disodium Guanylate",
      "631": "Disodium Inosinate",
      "635": "Disodium Ribonucleotides",
      "211": "Sodium Benzoate",
      "202": "Potassium Sorbate",
      "220": "Sulphur Dioxide",
      "223": "Sodium Metabisulphite",
    };

    const found = [];

    Object.entries(additives).forEach(
      ([code, name]) => {
        const regex = new RegExp(
          `(?:E\\s*)?\\b${code}\\b`,
          "i"
        );

        if (regex.test(ocrText)) {
          found.push(`${code} - ${name}`);
        }
      }
    );

    if (/acidity\s*regulator/i.test(ocrText)) {
      found.push("Acidity Regulator");
    }

    if (/\bflavou?r\b/i.test(ocrText)) {
      found.push("Flavour");
    }

    if (/\bcolour\b|\bcolor\b/i.test(ocrText)) {
      found.push("Colour");
    }

    return [...new Set(found)];
  };

  // =====================================================
  // FSSAI LICENCE
  // =====================================================

  const findLicence = (ocrText) => {
    const patterns = [
      /fssai[\s\S]{0,120}?(\d{13,14})/i,
      /lic(?:ence|ense)?\s*(?:no|number)?\.?\s*[:.-]?\s*(\d{13,14})/i,
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return "Not detected";
  };

  // =====================================================
  // BATCH NUMBER
  // =====================================================

  const findBatch = (ocrText) => {
    const patterns = [
      /batch\s*(?:no|number|code)?\s*[:.-]?\s*([A-Z0-9/#_.-]{3,30})/i,
      /b\.?\s*no\.?\s*[:.-]?\s*([A-Z0-9/#_.-]{3,30})/i,
      /lot\s*(?:no|number|code)?\s*[:.-]?\s*([A-Z0-9/#_.-]{3,30})/i,
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);

      if (match) {
        return match[1].replace(/[.,;:]+$/, "");
      }
    }

    return "Not detected";
  };

  // =====================================================
  // MRP
  // =====================================================

  const findMRP = (ocrText) => {
    const patterns = [
      /m\.?\s*r\.?\s*p\.?\s*(?:rs\.?|₹|inr)?\s*[:.-]?\s*(\d+(?:\.\d{1,2})?)/i,

      /maximum\s*retail\s*price\s*(?:rs\.?|₹|inr)?\s*[:.-]?\s*(\d+(?:\.\d{1,2})?)/i,

      /(?:rs\.?|₹)\s*(\d+(?:\.\d{1,2})?)/i,
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);

      if (match) {
        return `Rs. ${match[1]}`;
      }
    }

    return "Not detected";
  };

  // =====================================================
  // DATES
  // =====================================================

  const findDate = (ocrText, type) => {
    let pattern;

    if (type === "mfg") {
      pattern =
        /(?:mfd|mfg|manufactured|packed|pkd)[\s:.-]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i;
    } else {
      pattern =
        /(?:expiry|exp|use\s*by|best\s*before)[\s:.-]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i;
    }

    const match = ocrText.match(pattern);

    if (match) {
      return match[1];
    }

    return "Not detected";
  };

  // =====================================================
  // NUTRITION
  // =====================================================

  const findNutrition = (ocrText) => {
    const values = [];

    const patterns = [
      [
        "Energy",
        /energy[\s:|.-]*(\d+(?:\.\d+)?)\s*(kcal|kj)/i,
      ],

      [
        "Protein",
        /protein[\s:|.-]*(\d+(?:\.\d+)?)\s*g/i,
      ],

      [
        "Total Fat",
        /total\s*fat[\s:|.-]*(\d+(?:\.\d+)?)\s*g/i,
      ],

      [
        "Carbohydrate",
        /carbohydrate[s]?[\s:|.-]*(\d+(?:\.\d+)?)\s*g/i,
      ],

      [
        "Total Sugars",
        /total\s*sugars?[\s:|.-]*(\d+(?:\.\d+)?)\s*g/i,
      ],

      [
        "Added Sugars",
        /added\s*sugars?[\s:|.-]*(\d+(?:\.\d+)?)\s*g/i,
      ],

      [
        "Saturated Fat",
        /saturated\s*fat[\s:|.-]*(\d+(?:\.\d+)?)\s*g/i,
      ],

      [
        "Sodium",
        /sodium[\s:|.-]*(\d+(?:\.\d+)?)\s*(mg|g)/i,
      ],
    ];

    patterns.forEach(([name, regex]) => {
      const match = ocrText.match(regex);

      if (match) {
        values.push({
          name,
          value: `${match[1]} ${match[2] || "g"}`,
        });
      }
    });

    return values;
  };

  // =====================================================
  // RUN OCR + ANALYSIS
  // =====================================================

  const runAnalysis = async () => {
    if (!image) {
      setError(
        "Please upload a product image first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setText("");
    setProgress(0);

    try {
      setProgress(10);

      const processedImage =
        await preprocessImage(image);

      setProgress(20);

      const ocrResult =
        await Tesseract.recognize(
          processedImage,
          "eng",
          {
            logger: (info) => {
              if (
                info.status ===
                "recognizing text"
              ) {
                const value =
                  Math.round(
                    (info.progress || 0) *
                      70
                  );

                setProgress(
                  20 + value
                );
              }
            },
          }
        );

      const rawText =
        ocrResult?.data?.text || "";

      const cleanedText =
        rawText
          .replace(/\r/g, "\n")
          .replace(/[“”]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/[|]/g, "I")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

      setText(cleanedText);

      setProgress(92);

      const ingredients =
        findIngredients(cleanedText);

      setResult({
        productName:
          findProductName(
            cleanedText
          ),

        ingredients,

        oil:
          findOil(cleanedText),

        allergens:
          findAllergens(
            `${cleanedText} ${ingredients}`
          ),

        additives:
          findAdditives(
            cleanedText
          ),

        licence:
          findLicence(
            cleanedText
          ),

        batch:
          findBatch(
            cleanedText
          ),

        mrp:
          findMRP(
            cleanedText
          ),

        mfg:
          findDate(
            cleanedText,
            "mfg"
          ),

        expiry:
          findDate(
            cleanedText,
            "expiry"
          ),

        nutrition:
          findNutrition(
            cleanedText
          ),
      });

      setProgress(100);

    } catch (err) {
      console.error(
        "OCR Error:",
        err
      );

      setError(
        "OCR scan failed. Please use a clear, well-lit product label image."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CLEAR
  // =====================================================

  const clearAll = () => {
    setImage(null);
    setPreview("");
    setText("");
    setProgress(0);
    setError("");
    setShowOCR(false);

    setResult({
      productName: "Not detected",
      ingredients: "Not detected",
      oil: "Not detected",
      allergens: [],
      additives: [],
      licence: "Not detected",
      batch: "Not detected",
      mrp: "Not detected",
      mfg: "Not detected",
      expiry: "Not detected",
      nutrition: [],
    });
  };

  const hasWarnings =
    result.allergens.length > 0 ||
    result.additives.length > 0;

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="dossier">

      {/* HEADER */}

      <header className="masthead">

        <div className="masthead-left">

          <div className="stamp-mark">
            NR
          </div>

          <div>
            <h1>NIRIKSHA</h1>

            <p>
              AI-Powered Compliance &
              Verification System
            </p>
          </div>

        </div>

        <div className="masthead-right">

          <span className="dot"></span>

          OCR Terminal Active

        </div>

      </header>

      {/* UPLOAD */}

      <section className="intake">

        <div className="intake-tab">
          EXHIBIT A — PRODUCT PHOTO
        </div>

        {!preview ? (

          <label className="dropzone">

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />

            <div className="dropzone-icon">
              ＋
            </div>

            <h4>
              Attach product photo
            </h4>

            <p>
              Click to browse, or select
              JPG / PNG / WEBP
            </p>

          </label>

        ) : (

          <div className="frame-wrap">

            <div className="photo-frame">

              <img
                src={preview}
                alt="Uploaded product"
              />

              {loading && (

                <div className="scan-overlay">

                  <div
                    className="scan-line"
                    style={{
                      top: `${progress}%`,
                    }}
                  ></div>

                  <div className="scan-tint"></div>

                  <div className="scan-readout">

                    <span className="scan-percent">
                      {progress}%
                    </span>

                    <span className="scan-status">
                      Scanning
                    </span>

                  </div>

                </div>

              )}

              {!loading && text && (

                <div
                  className={`stamp ${
                    hasWarnings
                      ? "stamp-caution"
                      : "stamp-clear"
                  }`}
                >
                  {hasWarnings
                    ? "REVIEW"
                    : "SCANNED"}
                </div>

              )}

            </div>

            <div className="intake-actions">

              <label className="btn btn-ghost">

                Replace Photo

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />

              </label>

              <button
                className="btn btn-primary"
                onClick={runAnalysis}
                disabled={loading}
              >
                {loading
                  ? `Scanning ${progress}%`
                  : "Run Analysis"}
              </button>

              <button
                className="btn btn-ghost"
                onClick={clearAll}
              >
                Clear
              </button>

            </div>

          </div>

        )}

        {error && (

          <div className="notice notice-error">
            {error}
          </div>

        )}

      </section>

      {/* REPORT */}

      {text && (

        <section className="report">

          <div className="report-tab">
            EXHIBIT B — EXTRACTED RECORD
          </div>

          <div className="report-head">

            <span className="report-eyebrow">
              Product Name
            </span>

            <h2>
              {result.productName}
            </h2>

          </div>

          <div className="field-grid">

            <div className="field field-wide">

              <span className="field-label">
                Ingredients
              </span>

              <p>
                {result.ingredients}
              </p>

            </div>

            <div className="field">

              <span className="field-label">
                Cooking Oil
              </span>

              <p>
                {result.oil}
              </p>

            </div>

            <div className="field">

              <span className="field-label">
                Allergens
              </span>

              {result.allergens.length >
              0 ? (

                <div className="chip-row">

                  {result.allergens.map(
                    (item) => (

                      <span
                        className="chip chip-danger"
                        key={item}
                      >
                        {item}
                      </span>

                    )
                  )}

                </div>

              ) : (

                <p className="ok-text">
                  None detected
                </p>

              )}

            </div>

            <div className="field">

              <span className="field-label">
                Additives / E-Numbers
              </span>

              {result.additives.length >
              0 ? (

                <div className="chip-row">

                  {result.additives.map(
                    (item) => (

                      <span
                        className="chip"
                        key={item}
                      >
                        {item}
                      </span>

                    )
                  )}

                </div>

              ) : (

                <p className="ok-text">
                  None detected
                </p>

              )}

            </div>

          </div>

          <div className="ledger">

            <div className="ledger-row">
              <span>
                FSSAI Licence No.
              </span>

              <strong>
                {result.licence}
              </strong>
            </div>

            <div className="ledger-row">
              <span>
                Batch No.
              </span>

              <strong>
                {result.batch}
              </strong>
            </div>

            <div className="ledger-row">
              <span>
                MRP
              </span>

              <strong>
                {result.mrp}
              </strong>
            </div>

            <div className="ledger-row">
              <span>
                Manufacturing / Packing Date
              </span>

              <strong>
                {result.mfg}
              </strong>
            </div>

            <div className="ledger-row highlight">
              <span>
                Expiry / Best Before
              </span>

              <strong>
                {result.expiry}
              </strong>
            </div>

          </div>

          <div className="nutrition">

            <span className="field-label">
              Nutrition Information
            </span>

            {result.nutrition.length >
            0 ? (

              <div className="nutrition-grid">

                {result.nutrition.map(
                  (item) => (

                    <div
                      className="nutrition-cell"
                      key={item.name}
                    >

                      <span>
                        {item.name}
                      </span>

                      <strong>
                        {item.value}
                      </strong>

                    </div>

                  )
                )}

              </div>

            ) : (

              <p className="muted">
                Nutrition panel not detected.
              </p>

            )}

          </div>

          {hasWarnings && (

            <div className="caution-banner">

              <strong>
                Flagged for review —
              </strong>{" "}

              allergens and/or additives
              were detected. Verify the
              extracted information against
              the original package label.

            </div>

          )}

          <button
            className="ocr-toggle"
            onClick={() =>
              setShowOCR(
                !showOCR
              )
            }
          >
            {showOCR
              ? "Hide raw OCR transcript ▲"
              : "View raw OCR transcript ▼"}
          </button>

          {showOCR && (

            <pre className="ocr-transcript">
              {text}
            </pre>

          )}

        </section>

      )}

      {/* FOOTER */}

      <footer className="foot">

        <span>
          NIRIKSHA
        </span>

        <span>
          On-device OCR · image stays
          in browser
        </span>

      </footer>

    </div>
  );
}

export default App;