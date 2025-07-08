import * as bip39 from "bip39";
import { HDKey } from "micro-ed25519-hdkey";
import { Keypair } from "@solana/web3.js";
import { Buffer } from "buffer";

window.Buffer = Buffer;

window.addEventListener("DOMContentLoaded", () => {
    try {
        // Генерация сидфразы
        const mnemonic = bip39.generateMnemonic();

        // Получаем seed и keypair
        const seed = bip39.mnemonicToSeedSync(mnemonic, "");
        const hd = HDKey.fromMasterSeed(seed.toString("hex"));
        const path = "m/44'/501'/0'/0'";
        const child = hd.derive(path);
        const keypair = Keypair.fromSeed(child.privateKey);
        const publicKey = keypair.publicKey.toBase58();

        // Сохраняем адрес в localStorage
        localStorage.setItem("walletAddress", publicKey);

        // Вывод сидфразы в колонки с нумерацией
        const mnemonicContainer = document.getElementById("mnemonic-container");
        const addressContainer = document.getElementById("address-container");
        if (!mnemonicContainer || !addressContainer) throw new Error("Элементы не найдены");

        const words = mnemonic.split(" ");
        if (words.length !== 12) throw new Error("Сидфраза не 12 слов");

        const firstCol = words.slice(0, 6);
        const secondCol = words.slice(6);

        function createColumn(wordsArray: string[], startIndex: number): string {
            return `
        <ol start="${startIndex}" class="mnemonic-column">
          ${wordsArray.map(word => `<li>${word}</li>`).join("")}
        </ol>
      `;
        }

        mnemonicContainer.innerHTML = `
      <div style="display:flex; justify-content:center; gap: 40px;">
        ${createColumn(firstCol, 1)}
        ${createColumn(secondCol, 7)}
      </div>
    `;

        addressContainer.innerHTML = `<p><strong>Адрес кошелька:</strong> ${publicKey}</p>`;

    } catch (err) {
        console.error(err);
        alert("Ошибка генерации кошелька");
    }
});
