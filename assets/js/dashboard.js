window.addEventListener("pageshow", function () {
    const sesiAktif = JSON.parse(
        localStorage.getItem("nivexaUser") || "null"
    );

    if (!sesiAktif || !sesiAktif.email) {
        window.location.replace("login.html");
    }
});
document.addEventListener("DOMContentLoaded", () => {

    const namaUser = JSON.parse(localStorage.getItem("nivexaUser"));
    const akunUser = JSON.parse(localStorage.getItem("nivexaAccount") || "{}");

    if (!namaUser) {
        window.location.replace("login.html")
        return;
    }

    const userElement = document.getElementById("namaUser");

    if (userElement) {
        userElement.textContent = akunUser .nama || namaUser.email;
    }
    const sidebarNamaUser =
    document.getElementById("sidebarNamaUser");

if (sidebarNamaUser) {
    sidebarNamaUser.textContent =
        akunUser.nama || namaUser.email;
}

    const tombolMulai = document.getElementById("mulaiBtn");

    if (tombolMulai) {
        tombolMulai.addEventListener("click", () => {
            window.location.href = "../index.html";
        });
    }

});
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("nivexaUser");
        window.location.href = "login.html";
    });
}
document.addEventListener("DOMContentLoaded", async () => {
    const user = JSON.parse(
        localStorage.getItem("nivexaUser")
    );

   const sidebarKredit =
    document.getElementById("sidebarKredit");

const sidebarSaldoKredit =
    document.getElementById("sidebarSaldoKredit");

if (!user || !user.email) {
    return;
}
    try {
        const response = await fetch(
    "https://nivexa-ai-2.onrender.com/saldo-kredit?email=" +
    encodeURIComponent(user.email)
);

        const hasil = await response.json();
console.log("HASIL SALDO:", hasil);
        if (hasil.success) {
    const kredit = Number(hasil.kredit || 0);

    if (sidebarSaldoKredit) {
        sidebarSaldoKredit.textContent = kredit;
    }

    if (sidebarKredit) {
        if (kredit > 0) {
            sidebarKredit.style.display = "block";
        } else {
            sidebarKredit.style.display = "none";
        }
    }

    const kreditGratis =
        document.getElementById("KreditGratis");

    if (kreditGratis) {
        kreditGratis.textContent = kredit;
    }
}
    } catch (error) {
        console.error(
            "Gagal memuat saldo kredit:",
            error
        );
    }
});
console.log("DASHBOARD JS BARU AKTIF");
document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(
        localStorage.getItem("nivexaUser") || "{}"
    );

    const jumlahRiwayat =
        document.getElementById("jumlahRiwayat");

    if (!user.email || !jumlahRiwayat) {
        return;
    }

    const keyRiwayat =
        "nivexa-riwayat-foto-" + user.email.toLowerCase();

    const riwayat = JSON.parse(
        localStorage.getItem(keyRiwayat) || "[]"
    );

    jumlahRiwayat.textContent = riwayat.length;
});
// =============================================
// MENU SIDEBAR NIVEXA
// =============================================

const menuToggle =
    document.getElementById("menuToggle");

const sidebar =
    document.getElementById("sidebar");

const sidebarClose =
    document.getElementById("sidebarClose");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");


function bukaSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
}


function tutupSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
}


if (menuToggle) {
    menuToggle.addEventListener(
        "click",
        bukaSidebar
    );
}


if (sidebarClose) {
    sidebarClose.addEventListener(
        "click",
        tutupSidebar
    );
}


if (sidebarOverlay) {
    sidebarOverlay.addEventListener(
        "click",
        tutupSidebar
    );
}


// Tekan ESC untuk menutup menu
document.addEventListener(
    "keydown",
    function (event) {
        if (event.key === "Escape") {
            tutupSidebar();
        }
    }
);