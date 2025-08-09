import { Buffer } from "buffer";
window.Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

const SERVER_URL = 'https://zapzap666.xyz';

async function generateQR(amountValue: string, coin: string): Promise<void> {
    console.log('Starting QR generation:', { amountValue, coin });

    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;
    const publicKeyString = localStorage.getItem("walletAddress");

    console.log('Wallet address from localStorage:', publicKeyString);

    if (!publicKeyString || !amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
        console.error('Validation failed:', { publicKeyString: !!publicKeyString, amountValue, isValid: !isNaN(Number(amountValue)) && Number(amountValue) > 0 });
        showError("Invalid wallet address or amount");
        return;
    }

    showLoader(qrContainer, paymentInfo);

    try {
        const response = await fetch(`${SERVER_URL}/api/payment/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: publicKeyString,
                amount: parseFloat(amountValue),
                token: coin
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.success && data.data?.qr_code) {
            const payment = data.data;

            paymentInfo.innerHTML = `
                <div class="text-center">
                    <div class="text-22 font-bold text-white mb-1 leading-tight">${amountValue} ${coin}</div>
                </div>
            `;

            const existingQR = qrContainer.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const qrCodeWrapper = document.createElement('div');
            qrCodeWrapper.className = 'qr-code-wrapper';

            const qrImage = document.createElement('img');
            qrImage.src = payment.qr_code;
            qrImage.alt = 'Payment QR Code';
            qrImage.style.maxWidth = '250px';
            qrImage.style.maxHeight = '250px';

            qrImage.onload = () => console.log('QR image loaded successfully');
            qrImage.onerror = () => {
                console.error('QR image failed to load');
                showError("QR code image failed to load");
            };

            qrCodeWrapper.appendChild(qrImage);
            qrContainer.appendChild(qrCodeWrapper);

            qrContainer.style.display = "flex";
            hideSelectors();
        } else {
            throw new Error('Invalid server response');
        }
    } catch (error: any) {
        console.error('QR generation failed:', error);
        showError(`Failed to generate QR code: ${error.message}`);
    }
}

function showLoader(qrContainer: HTMLDivElement, paymentInfo: HTMLDivElement): void {
    paymentInfo.innerHTML = `
        <div class="text-crypto-text-muted text-sm">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-crypto-text-muted mx-auto mb-2"></div>
            Creating payment...
        </div>
    `;
    qrContainer.style.display = "flex";
}

function showError(message: string): void {
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;

    paymentInfo.innerHTML = `
        <div class="text-red-400 text-sm text-center">
            ${message}
        </div>
    `;
    qrContainer.style.display = "flex";
}

function hideSelectors(): void {
    const dropdown = document.querySelector(".dropdown") as HTMLDivElement;
    const coinSelector = document.getElementById("coinSelector") as HTMLDivElement;
    const amountSection = document.getElementById("amountSection") as HTMLDivElement;

    if (dropdown) dropdown.style.display = "none";
    if (coinSelector) coinSelector.style.display = "none";
    if (amountSection) amountSection.style.display = "none";
}

async function testServerConnection(): Promise<void> {
    try {
        const response = await fetch(`${SERVER_URL}/api/test`);
        if (response.ok) {
            const data = await response.json();
            console.log('Server test successful:', data);
        } else {
            console.error('Server test failed:', response.status);
        }
    } catch (error) {
        console.error('Server connection test failed:', error);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    testServerConnection();

    const dropdownBtn = document.getElementById("dropdownBtn") as HTMLButtonElement;
    const dropdownContent = document.getElementById("dropdownContent") as HTMLDivElement;
    const dropdownArrow = document.getElementById("dropdownArrow") as HTMLSpanElement;
    const dropdownItems = document.querySelectorAll(".dropdown-item") as NodeListOf<HTMLDivElement>;
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const coinSelector = document.getElementById("coinSelector") as HTMLDivElement;
    const amountSection = document.getElementById("amountSection") as HTMLDivElement;
    const amountInput = document.getElementById("amountInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;

    let selectedCoin = "SOL";
    qrContainer.style.display = "none";

    if (!dropdownBtn || !dropdownContent || !dropdownArrow) {
        console.error('Critical dropdown elements missing');
        return;
    }

    dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownContent.classList.toggle("hidden");
        dropdownArrow.classList.toggle("dropdown-arrow-rotate");
    });

    dropdownItems.forEach(item => {
        item.addEventListener("click", () => {
            const selectedText = item.textContent || "";
            dropdownBtn.childNodes[0].textContent = selectedText;
            dropdownContent.classList.add("hidden");
            dropdownArrow.classList.remove("dropdown-arrow-rotate");

            coinSelector.style.display = "flex";
            coinSelector.classList.remove("hidden");
        });
    });

    const coinItems = document.querySelectorAll(".coin-item") as NodeListOf<HTMLDivElement>;
    coinItems.forEach(item => {
        item.addEventListener("click", () => {
            selectedCoin = item.getAttribute("data-coin") || "SOL";

            coinItems.forEach(coin => {
                coin.classList.remove("text-white");
                coin.classList.add("text-crypto-text-muted");
            });
            item.classList.remove("text-crypto-text-muted");
            item.classList.add("text-white");

            amountSection.style.display = "block";
            amountSection.classList.remove("hidden");
            amountInput.focus();
        });
    });

    generateBtn.addEventListener("click", async () => {
        const amountValue = amountInput.value.trim();

        if (!amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
            showError("Please enter a valid amount");
            return;
        }

        generateBtn.disabled = true;
        generateBtn.textContent = "Creating...";

        try {
            await generateQR(amountValue, selectedCoin);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate QR";
        }
    });

    amountInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !generateBtn.disabled) {
            generateBtn.click();
        }
    });

    window.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.dropdown')) {
            dropdownContent.classList.add("hidden");
            dropdownArrow.classList.remove("dropdown-arrow-rotate");
        }
    });
});
