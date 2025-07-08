const qrButton = document.getElementById("qrButton") as HTMLButtonElement | null;

qrButton?.addEventListener("click", () => {
    window.location.href = "QRGenerate.html";
});
