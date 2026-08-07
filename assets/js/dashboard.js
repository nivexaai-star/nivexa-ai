document.addEventListener("DOMContentLoaded", () => {

    const namaUser = JSON.parse(localStorage.getItem("nivexaUser"));

    if (!namaUser) {
        window.location.href = "login.html";
        return;
    }

    const userElement = document.getElementById("namaUser");

    if (userElement) {
        userElement.textContent = namaUser.email;
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