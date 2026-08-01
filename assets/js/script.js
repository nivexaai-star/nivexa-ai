const inputFoto = document.getElementById("foto");
const previewBox = document.getElementById("previewBox");
const previewFoto = document.getElementById("previewFoto");
const namaFile = document.getElementById("namaFile");
const tombolBuatVideo = document.getElementById("buatVideo");
const promptGerakan = document.getElementById("promptGerakan");

let alamatFoto = "";

inputFoto.addEventListener("change", function () {
    const file = inputFoto.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Silakan pilih file gambar.");
        inputFoto.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert("Ukuran foto maksimal 10 MB.");
        inputFoto.value = "";
        return;
    }

    if (alamatFoto) {
        URL.revokeObjectURL(alamatFoto);
    }

    alamatFoto = URL.createObjectURL(file);

    previewFoto.src = alamatFoto;
    namaFile.textContent = file.name;
    previewBox.hidden = false;

    hapusHasilLama();
    sembunyikanProgress();

    tombolBuatVideo.textContent = "Buat Video AI";
});

tombolBuatVideo.addEventListener("click", async function () {
    const file = inputFoto.files[0];
    const prompt = promptGerakan.value.trim();

    if (!file) {
        alert("Silakan pilih foto terlebih dahulu.");
        return;
    }

    if (!prompt) {
        alert(
            "Silakan tulis perintah gerakan video terlebih dahulu."
        );

        promptGerakan.focus();
        return;
    }

    tombolBuatVideo.disabled = true;
    hapusHasilLama();

    try {
        tampilkanProgress();

        ubahProgress(
            10,
            "Mengirim foto dan prompt ke server..."
        );

        const dataFoto = new FormData();

        dataFoto.append("photo", file);
        dataFoto.append("prompt", prompt);

        ubahProgress(
            25,
            "Menghubungi AI pembuat video..."
        );

        const response = await fetch(
            "http://localhost:3000/generate-video",
            {
                method: "POST",
                body: dataFoto
            }
        );

        let hasil;

        try {
            hasil = await response.json();
        } catch {
            throw new Error(
                "Server mengirim respons yang tidak dapat dibaca."
            );
        }

        if (!response.ok || !hasil.success) {
            throw new Error(
                hasil.message || "Video AI gagal dibuat."
            );
        }

        if (!hasil.videoUrl) {
            throw new Error(
                "Alamat video tidak ditemukan dalam respons server."
            );
        }

        ubahProgress(
            90,
            "Menyiapkan hasil video..."
        );

        await tunggu(700);

        ubahProgress(
            100,
            "Video AI berhasil dibuat."
        );

        await tunggu(500);

        sembunyikanProgress();

        tampilkanHasilVideo(
            hasil.videoUrl,
            prompt,
            hasil.fileName
        );

        tombolBuatVideo.textContent =
            "Buat Ulang Video";
    } catch (error) {
        console.error(error);

        sembunyikanProgress();

        tombolBuatVideo.textContent =
            "Coba Lagi";

        alert(
            "Terjadi masalah:\n" +
            error.message
        );
    } finally {
        tombolBuatVideo.disabled = false;
    }
});

function tampilkanProgress() {
    let progressBox =
        document.getElementById("progressBox");

    if (!progressBox) {
        progressBox = document.createElement("div");

        progressBox.id = "progressBox";
        progressBox.className = "progress-box";

        progressBox.innerHTML = `
            <p id="progressText">
                Menyiapkan proses...
            </p>

            <div class="progress-track">
                <div
                    id="progressBar"
                    class="progress-bar"
                ></div>
            </div>

            <strong id="progressPercent">
                0%
            </strong>

            <p class="progress-note">
                Pembuatan video AI dapat membutuhkan
                beberapa menit. Jangan tutup halaman.
            </p>
        `;

        previewBox.appendChild(progressBox);
    }

    progressBox.hidden = false;

    ubahProgress(
        0,
        "Menyiapkan proses..."
    );
}

function ubahProgress(persen, teks) {
    const progressBar =
        document.getElementById("progressBar");

    const progressText =
        document.getElementById("progressText");

    const progressPercent =
        document.getElementById("progressPercent");

    if (
        !progressBar ||
        !progressText ||
        !progressPercent
    ) {
        return;
    }

    progressBar.style.width = persen + "%";
    progressText.textContent = teks;
    progressPercent.textContent = persen + "%";

    tombolBuatVideo.textContent = teks;
}

function sembunyikanProgress() {
    const progressBox =
        document.getElementById("progressBox");

    if (progressBox) {
        progressBox.hidden = true;
    }
}

function tampilkanHasilVideo(
    alamatVideo,
    prompt,
    namaVideo
) {
    hapusHasilLama();

    const hasilBox =
        document.createElement("section");

    hasilBox.id = "hasilVideo";
    hasilBox.className = "hasil-video";

    const namaDownload =
        namaVideo || "nivexa-ai-video.mp4";

    hasilBox.innerHTML = `
        <h2>Video AI Berhasil Dibuat</h2>

        <p class="hasil-keterangan">
            Video ini dibuat dari foto dan perintah
            gerakan menggunakan AI.
        </p>

        <video
            class="video-demo"
            src="${amanTeks(alamatVideo)}"
            controls
            autoplay
            loop
            playsinline
        ></video>

        <p class="prompt-hasil">
            <strong>Perintah:</strong>
            ${amanTeks(prompt)}
        </p>

        <div class="hasil-buttons">
            <button
                id="putarVideo"
                class="secondary"
                type="button"
            >
                Jeda Video
            </button>

            <a
                class="primary download-video"
                href="${amanTeks(alamatVideo)}"
                download="${amanTeks(namaDownload)}"
            >
                Download Video AI
            </a>
        </div>
    `;

    previewBox.insertAdjacentElement(
        "afterend",
        hasilBox
    );

    const video =
        hasilBox.querySelector(".video-demo");

    const tombolPutar =
        document.getElementById("putarVideo");

    tombolPutar.addEventListener(
        "click",
        function () {
            if (video.paused) {
                video.play();
                tombolPutar.textContent =
                    "Jeda Video";
            } else {
                video.pause();
                tombolPutar.textContent =
                    "Putar Video";
            }
        }
    );

    hasilBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function hapusHasilLama() {
    const hasilLama =
        document.getElementById("hasilVideo");

    if (hasilLama) {
        hasilLama.remove();
    }
}

function amanTeks(teks) {
    const elemen =
        document.createElement("div");

    elemen.textContent = teks || "";

    return elemen.innerHTML;
}

function tunggu(waktu) {
    return new Promise(function (resolve) {
        setTimeout(resolve, waktu);
    });
}