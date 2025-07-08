import * as bip39 from "bip39";
import { HDKey } from "micro-ed25519-hdkey";
import { Keypair } from "@solana/web3.js";
import { Buffer } from "buffer";

window.Buffer = Buffer;

const importBtn = document.getElementById("button") as HTMLButtonElement | null;
const mnemonicInput = document.getElementById("mnemonicInput") as HTMLTextAreaElement | null;

importBtn?.addEventListener("click", () => {
    const mnemonic = mnemonicInput?.value.trim();

    if (!mnemonic) {
        alert("Введите сид-фразу.");
        return;
    }

    const isValid = bip39.validateMnemonic(mnemonic);
    if (!isValid) {
        alert("Неудача: сид-фраза неверна.");
        return;
    }

    try {
        const seed = bip39.mnemonicToSeedSync(mnemonic, "");
        const hd = HDKey.fromMasterSeed(seed.toString("hex"));
        const path = "m/44'/501'/0'/0'";
        const child = hd.derive(path);
        const keypair = Keypair.fromSeed(child.privateKey);
        const publicKey = keypair.publicKey.toBase58();-

        // Сохраняем адрес в localStorage
        localStorage.setItem("walletAddress", publicKey);

        // 🔴 Закомментировано: вывод адреса
        // alert(`Адрес кошелька:\n${publicKey}\n\nУспешно!`);

        // ✅ Выводим весь localStorage алертом
        alert(`LocalStorage:\n${JSON.stringify(localStorage, null, 2)}`);

        window.location.href = "Dashboard.html";

    } catch (err) {
        alert("Ошибка при восстановлении кошелька.");
    }
});
