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

    fetch("/login-user", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        email: email,
        password: password
    })
})
    .then(async function (response) {
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Login gagal."
            );
        }

        return data;
    })
    .then(function (data) {
        localStorage.setItem(
            "nivexaUser",
            JSON.stringify({
                nama: data.nama || "",
                email: data.email,
                kredit: Number(data.kredit || 0),
                loginAt: new Date().toISOString()
            })
        );

        window.location.href = "dashboard.html";
    })
    .catch(function (error) {
        tombolLogin.disabled = false;
        tombolLogin.textContent = "LOGIN";

        tampilkanPesan(
            error.message || "Login gagal.",
            true
        );
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
});