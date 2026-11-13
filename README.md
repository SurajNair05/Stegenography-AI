# StegoAI 🕵️‍♂️🎨

> **Hide secrets invisibly inside AI-generated images using Cryptography, LSB Steganography, and Shamir's Secret Sharing.**

StegoAI is a purely client-side web application that lets you securely embed hidden messages within image pixels. Because it runs entirely in the browser, your secrets, passwords, and images never touch a backend server.

---

## ✨ Features

*   **🔒 XOR Encryption:** Secure your hidden messages with a password using a symmetric XOR cipher. Without the exact password, the hidden message remains garbled noise.
*   **🖼️ LSB Steganography:** Hides your encrypted message in the Least Significant Bits (LSB) of the image's Red, Green, and Blue channels. The visual alteration is mathematically imperceptible to the human eye.
*   **🤖 AI Cover Generation:** Don't have a cover image? Type a prompt, and the app will instantly generate a unique, one-of-a-kind AI image (via Puter.js & Flux Schnell) to use as your steganographic vessel.
*   **🧩 Shamir's Secret Sharing (SSS):** Split a highly sensitive secret across **N** different AI-generated images. You specify a threshold **K**—meaning any *K* images can perfectly reconstruct the secret, but *K-1* images reveal absolutely nothing. (Powered by Galois Field GF(256) mathematics).
*   **🛡️ 100% Client-Side:** No databases. No backend servers. Total privacy.

---

## 🚀 Getting Started

Since StegoAI is built with Vanilla HTML, CSS, and JavaScript, there are no build steps, Node modules, or complex local environments to configure.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Surajnair21/Stegenography-AI.git
    ```
2.  **Open it in your browser:**
    Simply double-click `index.html` or serve it using a local live server (e.g., VSCode Live Server).

---

## 📖 How It Works

### 1. Encoding (Hiding a message)
When you upload an image and type a message, the app converts your text into a flat array of binary `1`s and `0`s. It then reads the image's pixel data and overwrites the lowest bit (the 1s place) of the R, G, and B color values. This changes a color value by a maximum of `± 1` (e.g., a red value of 150 becomes 151), which is invisible.

### 2. Decoding (Revealing a message)
The app reads the lowest bit of every pixel. It groups these bits into 8-bit bytes, recreating the characters of your message until it hits the invisible "Stop Symbol" (`\x00\x00\x00`).

### 3. Shamir's Secret Sharing
For ultra-secure secrets, the app uses polynomial interpolation over a finite field (Galois Field 256). It constructs a random mathematical curve where the Y-intercept is your secret byte. It evaluates this curve to create *N* points (shares) and hides one point in each image. Reconstructing the secret uses Lagrange Interpolation to find the Y-intercept again.

---

## ⚠️ Important Considerations

*   **PNG Only:** The application forces downloads in `.png` format. Do **not** compress or convert the encoded images to `.jpg` or send them through apps that heavily compress images (like WhatsApp or Messenger). Lossy compression completely destroys the hidden LSB pixel data.
*   **CORS & AI:** The AI generation feature uses Puter.js to fetch images. To prevent the HTML5 Canvas from becoming "tainted" by cross-origin security rules, the app dynamically intercepts the image and reloads it with `crossOrigin="Anonymous"`.

---

## 🛠️ Tech Stack
*   **Frontend Interface:** Vanilla HTML5 & CSS3 (Glassmorphism UI)
*   **Core Logic:** Vanilla JavaScript (ES6+)
*   **AI Integration:** [Puter.js](https://docs.puter.com) (`flux-1-schnell` model)

## 📄 License
This project is open-source and available under the MIT License. Feel free to fork, modify, and learn from the code!
