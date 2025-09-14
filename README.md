# DocCam
<img width="1920" height="1017" alt="image" src="https://github.com/user-attachments/assets/2601ca05-3fc0-4511-b017-487809bc71ad" />

DocCam is a simple, lightweight web-based document camera tool built with HTML, JavaScript, and CSS. It allows you to use your webcam to capture images of documents, whiteboards, or anything you’d like in real time directly from your browser.

---

## Features

- Real‑time webcam preview  
- Capture snapshots from your webcam  
- Simple, clean UI for focusing on document capture  
- Works entirely in the browser (no server dependency)

---

## Getting Started

### Prerequisites

- A modern web browser with webcam access (e.g., Chrome, Firefox, Edge, Safari)  
- Webcam hardware

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/linuts/DocCam.git
   ```

2. Navigate into the project directory:

   ```bash
   cd DocCam
   ```

3. You can run locally using any static file server. For example, with Python:

   ```bash
   # Python 3.x
   python3 -m http.server 8000
   ```

   Then open your browser to `http://localhost:8000`.

### Usage

- Open `index.html` in your browser (via a local server as above)  
- Allow the page permission to access your webcam  
- Use the interface to preview your camera input  
- Click **Capture** (or equivalent button) to take a snapshot  
- Save or use the snapshot as needed  

---

## Folder Structure

Here’s a high‑level look at what’s inside:

```
DocCam/
├── index.html       ← Main HTML page
├── script.js        ← JavaScript to handle video capture, snapshot logic, etc.
├── style.css        ← Styles for layout and appearance
└── CNAME            ← (If using for custom domain settings; can be ignored otherwise)
```

---

## Customization & Configuration

Possible ways to extend or adjust DocCam:

- **Styling** – Update `style.css` to change layout, colors, button styles, etc.  
- **Image formats / capture options** – Enhance `script.js` to support different file formats (PNG, JPEG, etc.), adjust resolution, compression quality.  
- **User interface** – Add features like cropping, zoom, rotate, etc.  
- **Saving/exporting** – Integrate download options or save to cloud/local storage.  

---

## Contributing

Contributions are welcome! If you’d like to help, here are some ways:

1. Fork the repo  
2. Create a feature branch (`git checkout -b feature-name`)  
3. Make your changes, add tests or documentation as applicable  
4. Submit a pull request with a clear description of what you’ve added or fixed  

Please ensure code is clean, readable, and well‑commented. If adding new features, document how they work.

---

## Contact

If you have questions, suggestions, or want to report bugs, please reach out:

- GitHub Issues page  
- Your email/contact if you want to share  
