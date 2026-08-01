const fotoInput = document.getElementById("v2FotoInput");
const previewFoto = document.getElementById("v2PreviewFoto");
const previewBox = document.getElementById("v2PreviewBox");

if (fotoInput) {
    fotoInput.addEventListener("change", function () {
        const file = this.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = function (e) {
            previewFoto.src = e.target.result;
            previewBox.hidden = false;
        };

        reader.readAsDataURL(file);
    });
}
const generateButton = document.getElementById("v2GenerateBtn");

if (generateButton) {
    generateButton.addEventListener("click", function () {

        window.location.href = "pages/loading.html";

    });
}