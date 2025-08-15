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

interface PaymentStatusResponse {
    success: boolean;
    data: {
        id: string;
        status: string;
        merchant: string;
        amount: number;
        token: string;
        signature: string;
        createdAt: string;
        verifiedAt: string;
        expiresAt: string;
        dual_transfers_completed?: boolean;
    };
}

// Глобальная переменная для отслеживания времени создания платежа
let paymentCreatedTime: number = 0;

async function generatePayment(amountValue: string, coin: string): Promise<void> {
    console.log('🛒 Creating CryptoNow payment:', { amountValue, coin });

    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;
    const publicKeyString = localStorage.getItem("walletAddress");

    if (!publicKeyString || !amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
        showError("Invalid wallet address or amount");
        return;
    }

    showLoader(qrContainer, paymentInfo);

    try {
        // ИСПРАВЛЕНИЕ: Запоминаем время создания платежа
        paymentCreatedTime = Date.now();
        console.log('⏰ Payment created at:', new Date(paymentCreatedTime).toISOString());

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

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.success && data.data?.solana_pay_url) {
            const paymentData: PaymentData = data.data;

            // Показываем базовую информацию о платеже
            paymentInfo.innerHTML = `
                <div class="text-center">
                    <div class="text-22 font-bold text-white mb-1 leading-tight">${amountValue} ${coin}</div>
                    <div class="text-xs text-green-400 mt-1">+ ${paymentData.fee_info.amount} ${coin} CryptoNow fee</div>
                    <div class="text-xs text-crypto-text-muted mt-1">ID: ${paymentData.id.slice(-8)}</div>
                </div>
            `;

            // Создаем QR код
            const existingQR = qrContainer.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const qrCodeWrapper = document.createElement('div');
            qrCodeWrapper.className = 'qr-code-wrapper';

            const qrImage = document.createElement('img');
            qrImage.alt = 'CryptoNow Payment QR Code';
            qrImage.style.maxWidth = '300px';
            qrImage.style.maxHeight = '300px';
            qrImage.style.borderRadius = '12px';

            if (data.data.qr_code) {
                qrImage.src = data.data.qr_code;
            } else {
                showError("Server did not provide QR code");
                return;
            }

            qrImage.onerror = () => showError("QR code image failed to load");

            qrCodeWrapper.appendChild(qrImage);
            qrContainer.appendChild(qrCodeWrapper);

            qrContainer.style.display = "flex";
            hideSelectors();

            // Начинаем мониторинг ТОЛЬКО успеха с проверкой времени
            startSuccessMonitoring(paymentData.id, paymentInfo, qrContainer);

        } else {
            throw new Error('Invalid server response - missing payment data');
        }
    } catch (error: any) {
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            showError("Connection failed - check server status");
        } else {
            showError(`Failed to create payment: ${error.message}`);
        }
    }
}

function startSuccessMonitoring(paymentId: string, paymentInfo: HTMLDivElement, qrContainer: HTMLDivElement): void {
    console.log('👀 Starting SUCCESS-ONLY monitoring for:', paymentId);
    console.log('⏰ Monitoring transactions after:', new Date(paymentCreatedTime).toISOString());

    let checkCount = 0;
    let hasShownSuccess = false; // ИСПРАВЛЕНИЕ: Флаг чтобы показать успех только один раз

    const checkInterval = setInterval(async () => {
        checkCount++;
        console.log(`🔄 Check #${checkCount} for payment:`, paymentId);

        try {
            const response = await fetch(`${SERVER_URL}/api/payment/${paymentId}/status`);

            if (!response.ok) {
                console.error('❌ Bad response:', response.status);
                return;
            }

            const data: PaymentStatusResponse = await response.json();
            console.log('📊 Status check:', {
                status: data.data.status,
                hasSignature: !!data.data.signature,
                dualTransfersCompleted: data.data.dual_transfers_completed,
                verifiedAt: data.data.verifiedAt
            });

            if (data.success && !hasShownSuccess) {
                // ПРОВЕРКА: Транзакция должна быть создана ПОСЛЕ нашего платежа
                if (data.data.dual_transfers_completed === true && data.data.signature && data.data.verifiedAt) {
                    const verifiedTime = new Date(data.data.verifiedAt).getTime();
                    const timeDiff = verifiedTime - paymentCreatedTime;

                    console.log('⏰ Time check:', {
                        paymentCreated: new Date(paymentCreatedTime).toISOString(),
                        transactionVerified: new Date(verifiedTime).toISOString(),
                        timeDifferenceMinutes: Math.round(timeDiff / 60000)
                    });

                    // ИСПРАВЛЕНИЕ: Принимаем только транзакции, созданные после нашего платежа
                    if (timeDiff >= -60000) { // Даем 1 минуту погрешности на время сервера
                        console.log('🎉 VALID DUAL TRANSFER FOUND!');
                        hasShownSuccess = true;
                        clearInterval(checkInterval);
                        showSuccessWithHash(paymentInfo, qrContainer, data.data.signature);
                    } else {
                        console.log('⚠️ Found old transaction, ignoring. Age:', Math.round(-timeDiff / 60000), 'minutes');
                    }
                } else if (data.data.status === 'completed' && data.data.signature && data.data.verifiedAt) {
                    // Fallback с той же проверкой времени
                    const verifiedTime = new Date(data.data.verifiedAt).getTime();
                    const timeDiff = verifiedTime - paymentCreatedTime;

                    if (timeDiff >= -60000) {
                        console.log('✅ Payment completed (fallback)');
                        hasShownSuccess = true;
                        clearInterval(checkInterval);
                        showSuccessWithHash(paymentInfo, qrContainer, data.data.signature);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Monitor error:', error);
        }
    }, 3000);

    // Таймаут 10 минут
    setTimeout(() => {
        console.log('⏰ Payment monitoring timeout after', checkCount, 'checks');
        clearInterval(checkInterval);
    }, 10 * 60 * 1000);
}

function showSuccessWithHash(paymentInfo: HTMLDivElement, qrContainer: HTMLDivElement, signature: string): void {
    console.log('✅ Showing success with transaction hash:', signature);

    // ИСПРАВЛЕНИЕ: Полностью очищаем контейнер перед добавлением нового контента
    qrContainer.innerHTML = '';

    // Показываем успех с хешем транзакции
    const successContent = document.createElement('div');
    successContent.className = 'success-content text-center p-6';

    successContent.innerHTML = `
        <div class="text-green-400 text-xl font-bold mb-4">🎉 Both transfers completed!</div>
        
        <div class="text-white text-sm mb-4">
            Transaction confirmed on Solana blockchain
        </div>
        
        <div class="bg-crypto-card border border-crypto-border rounded-lg p-4 mb-4">
            <div class="text-crypto-text-muted text-xs mb-2">Transaction Hash:</div>
            <div class="text-white text-xs font-mono break-all mb-3">${signature}</div>
            
            <a 
                href="https://solscan.io/tx/${signature}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors duration-200 inline-flex items-center gap-2"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15,3 21,3 21,9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View on Solscan
            </a>
        </div>
        
        <div class="text-xs text-crypto-text-muted">
            Merchant payment + CryptoNow fee confirmed
        </div>
    `;

    qrContainer.appendChild(successContent);
    qrContainer.style.display = "flex";

    // Обновляем информацию о платеже
    paymentInfo.innerHTML = `
        <div class="text-center">
            <div class="text-green-400 text-lg font-bold">✅ Payment Complete</div>
        </div>
    `;
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
        const response = await fetch(`${SERVER_URL}/api/test`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    console.log('🚀 CryptoNow Payment Setup loaded');

    const serverAvailable = await testServerConnection();

    const dropdownBtn = document.getElementById("dropdownBtn") as HTMLButtonElement;
    const dropdownContent = document.getElementById("dropdownContent") as HTMLDivElement;
    const dropdownArrow = document.getElementById("dropdownArrow") as HTMLSpanElement;
    const dropdownItems = document.querySelectorAll(".dropdown-item") as NodeListOf<HTMLDivElement>;
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const coinSelector = document.getElementById("coinSelector") as HTMLDivElement;
    const amountSection = document.getElementById("amountSection") as HTMLDivElement;
    const amountInput = document.getElementById("amountInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;

    let selectedCoin = "USDC";

    if (qrContainer) qrContainer.style.display = "none";

    // Показываем статус сервера
    const statusDiv = document.createElement('div');
    statusDiv.className = `text-xs text-center mb-4 px-4 py-2 bg-crypto-card border border-crypto-border rounded-lg ${
        serverAvailable ? 'text-green-400' : 'text-red-400'
    }`;
    statusDiv.innerHTML = serverAvailable ? '✅ CryptoNow server connected' : '❌ CryptoNow server unavailable';
    dropdownBtn?.parentNode?.insertBefore(statusDiv, dropdownBtn);

    // Event listeners
    dropdownBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
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