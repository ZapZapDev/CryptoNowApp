// Импортируем и настраиваем Buffer для Vite
import { Buffer } from "buffer";
window.Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

// Функция для загрузки Solana библиотек
async function loadSolanaLibraries() {
    try {
        const { encodeURL, createQR } = await import('@solana/pay');
        const { PublicKey } = await import('@solana/web3.js');
        return { encodeURL, createQR, PublicKey };
    } catch (error) {
        throw error;
    }
}

// Функция для генерации QR-кода в зависимости от выбранной сети
async function generateQR(network: string): Promise<void> {
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement | null;
    const publicKeyString = localStorage.getItem("walletAddress");

    if (!qrContainer) return;

    if (!publicKeyString) {
        qrContainer.innerHTML = '<p style="color: #f44336;">Адрес кошелька не найден</p>';
        return;
    }

    qrContainer.innerHTML = '<p style="color: #919093;">Генерация QR-кода...</p>';

    try {
        if (network === 'solana') {
            const { encodeURL, createQR, PublicKey } = await loadSolanaLibraries();
            const recipient = new PublicKey(publicKeyString);

            const urlParams = {
                recipient,
                label: "Solana Wallet Payment",
                message: "Send SOL to wallet"
            };

            const url = encodeURL(urlParams);
            const qr = createQR(url, 250, 'transparent');

            qrContainer.innerHTML = '';
            qr.append(qrContainer);
        } else if (network === 'ethereum') {
            // Логика для Ethereum
            qrContainer.innerHTML = `
                <div style="text-align: center; color: #919093;">
                    <p>QR-код для сети Ethereum</p>
                    <p style="font-size: 14px; word-break: break-all;">Адрес: ${publicKeyString}</p>
                </div>
            `;
        } else if (network === 'polygon') {
            // Логика для Polygon
            qrContainer.innerHTML = `
                <div style="text-align: center; color: #919093;">
                    <p>QR-код для сети Polygon</p>
                    <p style="font-size: 14px; word-break: break-all;">Адрес: ${publicKeyString}</p>
                </div>
            `;
        } else {
            // Для других сетей
            qrContainer.innerHTML = `
                <div style="text-align: center; color: #919093;">
                    <p>QR-код для сети ${network}</p>
                    <p style="font-size: 14px; word-break: break-all;">Адрес: ${publicKeyString}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Ошибка:", error);
        qrContainer.innerHTML = '<p style="color: #f44336;">Ошибка при генерации QR-кода</p>';
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const dropdownBtn = document.getElementById("dropdownBtn") as HTMLButtonElement | null;
    const dropdownContent = document.getElementById("dropdownContent") as HTMLDivElement | null;
    const dropdownItems = document.querySelectorAll(".dropdown-item") as NodeListOf<HTMLDivElement>;
    const selectedNetwork = document.getElementById("selectedNetwork") as HTMLDivElement | null;
    const networkName = document.getElementById("networkName") as HTMLSpanElement | null;
    const backBtn = document.getElementById("backBtn") as HTMLButtonElement | null;

    if (!dropdownBtn || !dropdownContent || !selectedNetwork || !networkName || !backBtn) {
        console.error("Некоторые элементы не найдены");
        return;
    }

    // Обработчик клика по кнопке dropdown
    dropdownBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        dropdownContent.classList.toggle("show");
        dropdownBtn.classList.toggle("active");
    });

    // Обработчик выбора элемента из dropdown
    dropdownItems.forEach(item => {
        item.addEventListener("click", (e: Event) => {
            e.stopPropagation();

            const selectedText = item.textContent || "";
            const selectedValue = item.getAttribute("data-network") || "";

            // Обновляем текст кнопки
            dropdownBtn.textContent = selectedText;

            // Показываем выбранную сеть
            networkName.textContent = selectedText;
            selectedNetwork.style.display = "block";

            // Закрываем dropdown
            dropdownContent.classList.remove("show");
            dropdownBtn.classList.remove("active");

            // Генерируем QR-код для выбранной сети
            generateQR(selectedValue);
        });
    });

    // Закрытие dropdown при клике вне его
    window.addEventListener("click", (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target.matches('.dropbtn') && !target.closest('.dropdown')) {
            dropdownContent.classList.remove("show");
            dropdownBtn.classList.remove("active");
        }
    });

    // Кнопка "Назад" для возврата на Dashboard
    backBtn.addEventListener("click", () => {
        window.location.href = "Dashboard.html";
    });

    // Генерируем QR при загрузке страницы (старый код для совместимости)
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement | null;
    const publicKeyString = localStorage.getItem("walletAddress");


});