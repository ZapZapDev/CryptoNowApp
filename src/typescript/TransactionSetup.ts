import { Buffer } from "buffer";

window.Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

const SERVER_URL = 'https://zapzap666.xyz';

interface PaymentData {
    id: string;
    solana_pay_url: string;
    amount: number;
    token: string;
    fee_info: {
        amount: number;
        wallet: string;
        token: string;
    };
}

async function generatePayment(amountValue: string, coin: string): Promise<void> {
    console.log('🛒 Creating CryptoNow payment:', { amountValue, coin });

    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;
    const publicKeyString = localStorage.getItem("walletAddress");

    if (!publicKeyString || !amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
        console.error('Validation failed:', {
            publicKeyString: !!publicKeyString,
            amountValue,
            isValid: !isNaN(Number(amountValue)) && Number(amountValue) > 0
        });
        showError("Invalid wallet address or amount");
        return;
    }

    showLoader(qrContainer, paymentInfo);

    try {
        console.log('📤 Creating payment on server...');

        const response = await fetch(`${SERVER_URL}/api/payment/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                recipient: publicKeyString,
                amount: parseFloat(amountValue),
                token: coin,
                label: `CryptoNow Payment ${amountValue} ${coin}`,
                message: `Payment of ${amountValue} ${coin} + 1 ${coin} CryptoNow fee`,
                orderId: `order_${Date.now()}`
            })
        });

        console.log('📥 Server response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Payment created:', data);

        if (data.success && data.data?.solana_pay_url) {
            const paymentData: PaymentData = data.data;

            // Проверяем что Solana Pay URL правильный
            console.log('🔍 Checking Solana Pay URL:', {
                url: paymentData.solana_pay_url,
                hasPrefix: paymentData.solana_pay_url.startsWith('solana:')
            });

            // Проверяем есть ли QR код от сервера
            console.log('🔍 Server QR code available:', !!data.data.qr_code);

            // Показываем информацию о платеже
            paymentInfo.innerHTML = `
                <div class="text-center">
                    <div class="text-22 font-bold text-white mb-1 leading-tight">${amountValue} ${coin}</div>
                    <div class="text-xs text-green-400 mt-1">+ ${paymentData.fee_info.amount} ${coin} CryptoNow fee</div>
                    <div class="text-xs text-crypto-text-muted mt-1">ID: ${paymentData.id.slice(-8)}</div>
                </div>
            `;

            // Создаем QR код как изображение
            const existingQR = qrContainer.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const qrCodeWrapper = document.createElement('div');
            qrCodeWrapper.className = 'qr-code-wrapper';

            const qrImage = document.createElement('img');
            qrImage.alt = 'CryptoNow Payment QR Code';
            qrImage.style.maxWidth = '300px';
            qrImage.style.maxHeight = '300px';
            qrImage.style.borderRadius = '12px';

            // ✅ ИСПРАВЛЕНИЕ: Используем QR от сервера если есть, иначе внешний сервис
            if (data.data.qr_code) {
                console.log('✅ Using server-generated QR code');
                qrImage.src = data.data.qr_code; // Base64 QR от сервера с правильным solana: префиксом
            } else {
                console.log('⚠️ Fallback to external QR service');
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymentData.solana_pay_url)}`;
                console.log('🎨 External QR Code URL:', qrCodeUrl);
                qrImage.src = qrCodeUrl;
            }

            qrImage.onerror = () => {
                console.error("QR image failed to load");
                showError("QR code image failed to load");
            };

            qrCodeWrapper.appendChild(qrImage);
            qrContainer.appendChild(qrCodeWrapper);

            qrContainer.style.display = "flex";
            hideSelectors();

            // Начинаем мониторинг платежа
            startPaymentMonitoring(paymentData.id, paymentInfo);

            console.log('✅ QR code generated successfully for payment:', paymentData.id);
        } else {
            console.error('Invalid server response structure:', data);
            throw new Error('Invalid server response - missing payment data');
        }
    } catch (error: any) {
        console.error('❌ Payment generation failed:', error);

        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            showError("Connection failed - check server status");
        } else {
            showError(`Failed to create payment: ${error.message}`);
        }
    }
}

function startPaymentMonitoring(paymentId: string, paymentInfo: HTMLDivElement): void {
    console.log('👀 Starting payment monitoring for:', paymentId);

    const checkInterval = setInterval(async () => {
        try {
            const response = await fetch(`${SERVER_URL}/api/payment/${paymentId}/status`);

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.data.status === 'completed') {
                    console.log('✅ Payment completed!', data.data);
                    clearInterval(checkInterval);

                    paymentInfo.innerHTML = `
                        <div class="text-center">
                            <div class="text-green-400 text-lg font-bold mb-2">✅ Payment Completed!</div>
                            <div class="text-white text-sm mb-1">${data.data.amount} ${data.data.token}</div>
                            <div class="text-xs text-crypto-text-muted">
                                Signature: ${data.data.signature?.slice(0, 8)}...
                            </div>
                        </div>
                    `;

                    // Скрываем QR код через 3 секунды
                    setTimeout(() => {
                        const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
                        if (qrContainer) {
                            qrContainer.style.display = 'none';
                        }
                    }, 3000);
                }
            }

        } catch (error) {
            console.error('❌ Payment monitoring error:', error);
        }
    }, 3000); // Проверяем каждые 3 секунды

    // Останавливаем мониторинг через 10 минут
    setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏰ Payment monitoring timeout');
    }, 10 * 60 * 1000);
}

function showLoader(qrContainer: HTMLDivElement, paymentInfo: HTMLDivElement): void {
    paymentInfo.innerHTML = `
        <div class="text-crypto-text-muted text-sm">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-crypto-text-muted mx-auto mb-2"></div>
            Creating CryptoNow payment...
        </div>
    `;
    qrContainer.style.display = "flex";
}

function showError(message: string): void {
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;

    paymentInfo.innerHTML = `
        <div class="text-red-400 text-sm text-center">
            ⚠️ ${message}
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

async function testServerConnection(): Promise<boolean> {
    try {
        console.log('🔗 Testing server connection to:', SERVER_URL);

        const response = await fetch(`${SERVER_URL}/api/test`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Server test successful:', data);
            return true;
        } else {
            console.error('❌ Server test failed with status:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Server connection test failed:', error);
        return false;
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    console.log('🚀 CryptoNow Payment Setup loaded');
    console.log('🔗 Server URL:', SERVER_URL);

    // Тестируем соединение с сервером
    const serverAvailable = await testServerConnection();
    console.log('Server available:', serverAvailable);

    const dropdownBtn = document.getElementById("dropdownBtn") as HTMLButtonElement;
    const dropdownContent = document.getElementById("dropdownContent") as HTMLDivElement;
    const dropdownArrow = document.getElementById("dropdownArrow") as HTMLSpanElement;
    const dropdownItems = document.querySelectorAll(".dropdown-item") as NodeListOf<HTMLDivElement>;
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const coinSelector = document.getElementById("coinSelector") as HTMLDivElement;
    const amountSection = document.getElementById("amountSection") as HTMLDivElement;
    const amountInput = document.getElementById("amountInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;

    let selectedCoin = "USDC"; // По умолчанию USDC

    if (qrContainer) {
        qrContainer.style.display = "none";
    }

    // Показываем статус сервера
    if (!serverAvailable) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'text-xs text-red-400 text-center mb-4 px-4 py-2 bg-crypto-card border border-crypto-border rounded-lg';
        statusDiv.innerHTML = '❌ CryptoNow server unavailable';
        dropdownBtn?.parentNode?.insertBefore(statusDiv, dropdownBtn);
    } else {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'text-xs text-green-400 text-center mb-4 px-4 py-2 bg-crypto-card border border-crypto-border rounded-lg';
        statusDiv.innerHTML = '✅ CryptoNow server connected';
        dropdownBtn?.parentNode?.insertBefore(statusDiv, dropdownBtn);
    }

    dropdownBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log('Dropdown button clicked!');
        dropdownContent?.classList.toggle("hidden");
        dropdownArrow?.classList.toggle("dropdown-arrow-rotate");
    });

    dropdownItems.forEach(item => {
        item.addEventListener("click", () => {
            const selectedText = item.textContent || "";
            if (dropdownBtn?.childNodes[0]) {
                dropdownBtn.childNodes[0].textContent = selectedText;
            }
            dropdownContent?.classList.add("hidden");
            dropdownArrow?.classList.remove("dropdown-arrow-rotate");

            if (coinSelector) {
                coinSelector.style.display = "flex";
                coinSelector.classList.remove("hidden");
            }
        });
    });

    const coinItems = document.querySelectorAll(".coin-item") as NodeListOf<HTMLDivElement>;
    coinItems.forEach(item => {
        item.addEventListener("click", () => {
            selectedCoin = item.getAttribute("data-coin") || "USDC";

            coinItems.forEach(coin => {
                coin.classList.remove("text-white");
                coin.classList.add("text-crypto-text-muted");
            });
            item.classList.remove("text-crypto-text-muted");
            item.classList.add("text-white");

            if (amountSection) {
                amountSection.style.display = "block";
                amountSection.classList.remove("hidden");
                amountInput?.focus();
            }
        });
    });

    generateBtn?.addEventListener("click", async () => {
        const amountValue = amountInput?.value.trim();

        if (!amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
            showError("Please enter a valid amount");
            return;
        }

        if (!serverAvailable) {
            showError("CryptoNow server is not available");
            return;
        }

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = "Creating...";
        }

        try {
            await generatePayment(amountValue, selectedCoin);
        } finally {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = "Generate QR";
            }
        }
    });

    amountInput?.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && generateBtn && !generateBtn.disabled && serverAvailable) {
            generateBtn.click();
        }
    });

    window.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.dropdown')) {
            dropdownContent?.classList.add("hidden");
            dropdownArrow?.classList.remove("dropdown-arrow-rotate");
        }
    });
});