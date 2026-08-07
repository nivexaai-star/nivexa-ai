const loginForm = document.getElementById("loginForm");
const tombolGoogle = document.querySelector(".google-btn");

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

    hapusPesan();

    if (!email || !password) {
        tampilkanPesan(
            "Email dan password harus diisi.",
            true
        );
        return;
    }

    if (password.length < 6) {
        tampilkanPesan(
            "Password minimal terdiri dari 6 karakter.",
            true
        );
        return;
    }

    const tombolLogin =
        loginForm.querySelector('button[type="submit"]');

    tombolLogin.disabled = true;
    tombolLogin.textContent = "MEMPROSES...";

    setTimeout(function () {
        localStorage.setItem(
            "nivexaUser",
            JSON.stringify({
                email: email,
                loginAt: new Date().toISOString()
            })
        );

        // Pindah ke halaman utama
        window.location.href ="dashboard.html";
    }, 900);
});

tombolGoogle.addEventListener("click", function () {
    hapusPesan();

    tampilkanPesan(
        "Login Google akan diaktifkan setelah sistem akun dipasang."
    );
});

function tampilkanPesan(teks, error = false) {
    hapusPesan();

    const pesan = document.createElement("p");

    pesan.id = "pesanLogin";
    pesan.className = error
        ? "pesan-login error"
        : "pesan-login";

    pesan.textContent = teks;

    loginForm.insertAdjacentElement(
        "afterend",
        pesan
    );
}

function hapusPesan() {
    const pesanLama =
        document.getElementById("pesanLogin");

    if (pesanLama) {
        pesanLama.remove();
    }

    const tombolLogin =
        loginForm.querySelector('button[type="submit"]');

    if (tombolLogin) {
        tombolLogin.disabled = false;
        tombolLogin.textContent = "LOGIN";
    }
}