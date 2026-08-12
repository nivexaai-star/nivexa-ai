const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
require("dotenv").config();
let falClient = null;

async function dapatkanFalClient() {
    if (!falClient) {
        const { fal } = await import("@fal-ai/client");

        fal.config({
            credentials: process.env.FAL_KEY
        });

        falClient = fal;
    }

    return falClient;
}
let modnetSegmenter = null;

async function dapatkanModnetSegmenter() {
    if (!modnetSegmenter) {
        console.log("Memuat MODNet Hapus Background...");

        const { pipeline } =
            await import("@huggingface/transformers");

        modnetSegmenter = await pipeline(
            "background-removal",
            "Xenova/modnet",
            {
                dtype: "fp32"
            }
        );

        console.log("MODNet siap digunakan.");
    }

    return modnetSegmenter;
}
const app = express();

const PORT = Number(process.env.PORT) || 3000;

const HF_SPACE =
    "mediasynthesismuseum/stable-video-diffusion";

const HF_SPACE_URL =
    "https://mediasynthesismuseum-stable-video-diffusion.hf.space";

const folderVideo = path.join(__dirname, "generated");
const folderPembayaran = path.join(
    __dirname,
    "uploads",
    "pembayaran"
);
const fileDataUser = path.join(
    __dirname,
    "uploads",
    "data-user.json"
);
const fileDataPembayaran = path.join(
    folderPembayaran,
    "transaksi.json"
);
app.use(
    cors({
        origin: [
            "https://nivexaai.net",
            "https://www.nivexaai.net"
        ],
        methods: [
            "GET",
            "POST",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type"
        ]
    })
);
app.use(express.json());
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "pages", "login.html"));
});

app.use(express.static(__dirname));

if (!fs.existsSync(folderVideo)) {
    fs.mkdirSync(folderVideo, {
        recursive: true
    });
}

if (!fs.existsSync(folderPembayaran)) {
    fs.mkdirSync(folderPembayaran, {
        recursive: true
    });
}

if (!fs.existsSync(fileDataPembayaran)) {
    fs.writeFileSync(
        fileDataPembayaran,
        JSON.stringify([], null, 2)
    );
}

app.use(
    "/uploads/pembayaran",
    express.static(folderPembayaran)
);

app.use(
    "/generated",
    express.static(folderVideo)
);

app.use("/generated", express.static(folderVideo));

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter(req, file, callback) {
        if (!file.mimetype.startsWith("image/")) {
            return callback(
                new Error("File harus berupa gambar.")
            );
        }

        callback(null, true);
    }
});
function cariUrlVideo(data) {
    if (!data) {
        return null;
    }

    if (typeof data === "string") {
        if (
            data.startsWith("http://") ||
            data.startsWith("https://") ||
            data.startsWith("/file=")
        ) {
            return data;
        }

        return null;
    }

    if (Array.isArray(data)) {
        for (const item of data) {
            const hasil = cariUrlVideo(item);

            if (hasil) {
                return hasil;
            }
        }

        return null;
    }

    if (typeof data === "object") {
        const kandidatLangsung = [
            data.url,
            data.video_url,
            data.download_url
        ];

        for (const kandidat of kandidatLangsung) {
            if (
                typeof kandidat === "string" &&
                kandidat.length > 0
            ) {
                return kandidat;
            }
        }

        for (const nilai of Object.values(data)) {
            const hasil = cariUrlVideo(nilai);

            if (hasil) {
                return hasil;
            }
        }
    }

    return null;
}

function buatUrlLengkap(url) {
    if (
        url.startsWith("http://") ||
        url.startsWith("https://")
    ) {
        return url;
    }

    return new URL(url, HF_SPACE_URL).href;
}

async function unduhVideo(url, lokasiTujuan) {
    const respons = await fetch(url);

    if (!respons.ok) {
        throw new Error(
            `Gagal mengunduh video hasil AI (${respons.status}).`
        );
    }

    const arrayBuffer = await respons.arrayBuffer();

    fs.writeFileSync(
        lokasiTujuan,
        Buffer.from(arrayBuffer)
    );
}
function bacaDataUser() {
    try {
        if (!fs.existsSync(fileDataUser)) {
            return [];
        }

        const isi = fs.readFileSync(
            fileDataUser,
            "utf8"
        );

        return JSON.parse(isi || "[]");
    } catch (error) {
        console.error(
            "Gagal membaca data user:",
            error
        );

        return [];
    }
}

function simpanDataUser(data) {
    try {
        fs.writeFileSync(
            fileDataUser,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.error(
            "Gagal menyimpan data user:",
            error
        );

        throw error;
    }
}
function bacaPembayaran() {
    try {
        const isi = fs.readFileSync(
            fileDataPembayaran,
            "utf8"
        );

        return JSON.parse(isi || "[]");
    } catch (error) {
        console.error(
            "Gagal membaca pembayaran:",
            error
        );

        return [];
    }
}

function simpanPembayaran(data) {
    fs.writeFileSync(
        fileDataPembayaran,
        JSON.stringify(data, null, 2)
    );
}
app.post("/register-user", async function (req, res) {
    try {
        const email = String(
            req.body.email || ""
        )
            .trim()
            .toLowerCase();
const nama = String(
    req.body.nama || ""
).trim();
const password = String(
    req.body.password || ""
).trim();

if (password.length < 6) {
    return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter."
    });
}

const passwordHash = await bcrypt.hash(password, 10);
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email wajib diisi."
            });
        }

        const dataUser = bacaDataUser();

        const userIndex = dataUser.findIndex(
            function (item) {
                return String(
                    item.email || ""
                )
                    .trim()
                    .toLowerCase() === email;
            }
        );

        if (userIndex !== -1) {
            return res.json({
                success: true,
                email: email,
                kredit: Number(
                    dataUser[userIndex].kredit || 0
                ),
                sudahAda: true
            });
        }

        dataUser.push({
    nama: nama,
    email: email,
    password: passwordHash,
    kredit: 1
});

        simpanDataUser(dataUser);

        return res.json({
            success: true,
            email: email,
            kredit: 1,
            sudahAda: false
        });

    } catch (error) {
        console.error(
            "Gagal membuat user baru:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal membuat akun pengguna."
        });
    }
});
app.post("/login-user", async function (req, res) {
    try {
        const email = String(
            req.body.email || ""
        )
            .trim()
            .toLowerCase();

        const password = String(
            req.body.password || ""
        );

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email dan password wajib diisi."
            });
        }

        const dataUser = bacaDataUser();

        const user = dataUser.find(function (item) {
            return String(
                item.email || ""
            )
                .trim()
                .toLowerCase() === email;
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Akun belum terdaftar."
            });
        }

        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: "Akun lama perlu didaftarkan ulang."
            });
        }

        const passwordBenar =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordBenar) {
            return res.status(401).json({
                success: false,
                message: "Email atau kata sandi salah."
            });
        }

        return res.json({
            success: true,
            nama: user.nama || "",
            email: user.email,
            kredit: Number(user.kredit || 0)
        });
    } catch (error) {
        console.error(
            "Gagal login user:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan saat login."
        });
    }
});
app.get("/status", function (req, res) {
    res.json({
        success: true,
        message: "Server NIVEXA AI aktif.",
        huggingFaceToken: Boolean(process.env.HF_TOKEN),
        falKey: Boolean(process.env.FAL_KEY),
        space: HF_SPACE
    });
});
app.get("/saldo-kredit", function (req, res) {
    try {
        const email = String(
            req.query.email || ""
        ).trim().toLowerCase();

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email wajib diisi."
            });
        }

        const dataUser = bacaDataUser();

        const user = dataUser.find(function (item) {
            return String(item.email || "")
                .trim()
                .toLowerCase() === email;
        });

        return res.json({
            success: true,
            email: email,
            kredit: user
                ? Number(user.kredit || 0)
                : 0
        });
    } catch (error) {
        console.error(
            "Gagal membaca saldo kredit:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Gagal membaca saldo kredit."
        });
    }
});
app.get("/debug-data-user", function (req, res) {
    try {
        const dataUser = bacaDataUser();

        return res.json({
            success: true,
            jumlahUser: dataUser.length,
            dataUser: dataUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
app.post("/kurangi-kredit", function (req, res) {
    try {
        const email = String(
            req.body.email || ""
        ).trim().toLowerCase();

        const jumlah = Number(
            req.body.jumlah || 1
        );

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email wajib diisi."
            });
        }

        const dataUser = bacaDataUser();

        const userIndex = dataUser.findIndex(
            function (item) {
                return String(
                    item.email || ""
                ).trim().toLowerCase() === email;
            }
        );

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Data pengguna tidak ditemukan."
            });
        }

        const kreditSekarang = Number(
            dataUser[userIndex].kredit || 0
        );

        if (kreditSekarang < jumlah) {
            return res.status(400).json({
                success: false,
                message: "Kredit tidak mencukupi."
            });
        }

        dataUser[userIndex].kredit =
            kreditSekarang - jumlah;

        simpanDataUser(dataUser);

        return res.json({
            success: true,
            email: email,
            kredit: dataUser[userIndex].kredit
        });

    } catch (error) {
        console.error(
            "Gagal mengurangi kredit:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Gagal mengurangi kredit."
        });
    }
});
app.post(
    "/kirim-pembayaran",
    upload.single("bukti"),

    function (req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Bukti pembayaran belum dipilih."
                });
            }

            const email =
    String(req.body.email || "").trim();

console.log("EMAIL PEMBAYARAN DITERIMA:", email);

const paket =
    String(req.body.paket || "").trim();

            const kredit =
                Number(req.body.kredit || 0);

            const harga =
                Number(req.body.harga || 0);

            const metode =
                String(req.body.metode || "").trim();

            if (
                !paket ||
                !kredit ||
                !harga ||
                !metode
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Data pembayaran belum lengkap."
                });
            }

            let ekstensi = ".jpg";

            if (
                req.file.mimetype === "image/png"
            ) {
                ekstensi = ".png";
            }

            if (
                req.file.mimetype === "image/webp"
            ) {
                ekstensi = ".webp";
            }

            const namaBukti =
                "bukti-" +
                Date.now() +
                ekstensi;

            const lokasiBukti = path.join(
                folderPembayaran,
                namaBukti
            );

            fs.writeFileSync(
                lokasiBukti,
                req.file.buffer
            );

            const transaksi = {
                id:
                    "NVX-" +
                    Date.now(),

                email:
                    email || "Email tidak diketahui",

                paket: paket,
                kredit: kredit,
                harga: harga,
                metode: metode,

                bukti:
                    "/uploads/pembayaran/" +
                    namaBukti,

                status:
                    "menunggu-verifikasi",

                dibuat:
                    new Date().toISOString()
            };

            const daftar =
                bacaPembayaran();

            daftar.unshift(transaksi);

            simpanPembayaran(daftar);

            console.log("");
            console.log(
                "💳 Pembayaran baru:",
                transaksi.id
            );

            return res.json({
                success: true,
                message:
                    "Bukti pembayaran berhasil dikirim ke admin.",
                transaksi: transaksi
            });
        } catch (error) {
            console.error(
                "Kesalahan pembayaran:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Bukti pembayaran gagal disimpan."
            });
        }
    }
);

app.get(
    "/admin/pembayaran",
    function (req, res) {
        return res.json({
            success: true,
            pembayaran:
                bacaPembayaran()
        });
    }
);
app.post(
    "/setujui-pembayaran/:id",
    function (req, res) {
        try {
            const id = String(req.params.id || "").trim();

            const pembayaran = JSON.parse(
                fs.readFileSync(
                    fileDataPembayaran,
                    "utf8"
                ) || "[]"
            );

            const index = pembayaran.findIndex(
                function (item) {
                    return item.id === id;
                }
            );

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Transaksi tidak ditemukan."
                });
            }
if (pembayaran[index].status === "disetujui") {
    return res.status(400).json({
        success: false,
        message:
            "Pembayaran ini sudah pernah disetujui."
    });
}
            pembayaran[index].status =
                "disetujui";

            pembayaran[index].disetujuiPada =
                new Date().toISOString();
const dataUser = bacaDataUser();

const emailPembeli = String(
    pembayaran[index].email || ""
).trim().toLowerCase();

const kreditDibeli = Number(
    pembayaran[index].kredit || 0
);

let userIndex = dataUser.findIndex(function (user) {
    return String(user.email || "")
        .trim()
        .toLowerCase() === emailPembeli;
});

if (userIndex === -1) {
    dataUser.push({
        email: emailPembeli,
        kredit: kreditDibeli
    });
} else {
    const kreditLama = Number(
        dataUser[userIndex].kredit || 0
    );

    dataUser[userIndex].kredit =
        kreditLama + kreditDibeli;
}

simpanDataUser(dataUser);
            fs.writeFileSync(
                fileDataPembayaran,
                JSON.stringify(
                    pembayaran,
                    null,
                    2
                )
            );

            return res.json({
                success: true,
                message:
                    "Pembayaran berhasil disetujui.",
                pembayaran:
                    pembayaran[index]
            });
        } catch (error) {
            console.error(
                "Gagal menyetujui pembayaran:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Pembayaran gagal disetujui."
            });
        }
    }
);
// ========================================
// ADMIN - TARIK / KOREKSI KREDIT PENGGUNA
// ========================================
app.post("/admin/tarik-kredit", function (req, res) {
    try {
        const email = String(
            req.body.email || ""
        ).trim().toLowerCase();

        const jumlah = Number(
            req.body.jumlah
        );

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email pengguna wajib diisi."
            });
        }

        if (
            !Number.isFinite(jumlah) ||
            jumlah <= 0 ||
            !Number.isInteger(jumlah)
        ) {
            return res.status(400).json({
                success: false,
                message: "Jumlah kredit tidak valid."
            });
        }

        const dataUser = bacaDataUser();

        const userIndex = dataUser.findIndex(
            function (user) {
                return (
                    String(user.email || "")
                        .trim()
                        .toLowerCase() === email
                );
            }
        );

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Pengguna tidak ditemukan."
            });
        }

        const kreditSekarang = Number(
            dataUser[userIndex].kredit || 0
        );

        if (jumlah > kreditSekarang) {
            return res.status(400).json({
                success: false,
                message:
                    "Kredit yang ditarik melebihi saldo pengguna."
            });
        }

        const kreditBaru =
            kreditSekarang - jumlah;

        dataUser[userIndex].kredit =
            kreditBaru;

        simpanDataUser(dataUser);

        console.log(
            "ADMIN TARIK KREDIT:",
            email,
            jumlah,
            "Saldo:",
            kreditBaru
        );

        return res.json({
            success: true,
            message:
                "Kredit berhasil ditarik.",
            email: email,
            kreditDitarik: jumlah,
            kreditSebelumnya: kreditSekarang,
            kreditSekarang: kreditBaru
        });

    } catch (error) {
        console.error(
            "Gagal menarik kredit:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Gagal menarik kredit pengguna."
        });
    }
});
app.post(
    "/edit-photo",
    upload.single("photo"),

    async function (req, res) {
        try {
            if (!process.env.FAL_KEY) {
                return res.status(500).json({
                    success: false,
                    message:
                        "FAL_KEY belum terbaca dari file .env."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Foto belum dipilih."
                });
            }

            const prompt =
                String(req.body.prompt || "").trim();

            if (!prompt) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Tuliskan perubahan foto yang diinginkan."
                });
            }

            console.log("");
            console.log("==============================");
            console.log("Memulai Edit Foto fal.ai");
            console.log("Foto:", req.file.originalname);
            console.log("Prompt:", prompt);
            console.log("==============================");

            const fal = await dapatkanFalClient();

            const fileFoto = new File(
                [req.file.buffer],
                req.file.originalname || "foto.jpg",
                {
                    type:
                        req.file.mimetype ||
                        "image/jpeg"
                }
            );

            console.log(
                "Mengunggah foto ke penyimpanan fal.ai..."
            );

            const imageUrl =
                await fal.storage.upload(fileFoto);

            console.log(
                "Foto berhasil diunggah:",
                imageUrl
            );

            console.log(
                "Mengirim permintaan Edit Foto ke fal.ai..."
            );

            const hasil = await fal.subscribe(
                "fal-ai/flux-kontext/dev",
                {
                    input: {
                        image_url: imageUrl,
                        prompt: prompt,
                        output_format: "png"
                    },

                    logs: true,

                    onQueueUpdate: function (update) {
                        if (
                            update.status === "IN_PROGRESS" &&
                            Array.isArray(update.logs)
                        ) {
                            update.logs.forEach(function (log) {
                                if (log.message) {
                                    console.log(
                                        "fal.ai:",
                                        log.message
                                    );
                                }
                            });
                        }
                    }
                }
            );

            const hasilData =
                hasil?.data || hasil;

            const urlHasil =
                hasilData?.images?.[0]?.url ||
                hasilData?.image?.url ||
                hasilData?.image?.image_url;

            if (!urlHasil) {
                console.log(
                    "Respons fal.ai:",
                    JSON.stringify(hasilData, null, 2)
                );

                throw new Error(
                    "URL hasil Edit Foto tidak ditemukan."
                );
            }

            const namaFile =
                "nivexa-edit-" +
                Date.now() +
                ".png";

            const lokasiFile = path.join(
                folderVideo,
                namaFile
            );

            console.log(
                "Mengunduh hasil Edit Foto..."
            );

            const responseGambar =
                await fetch(urlHasil);

            if (!responseGambar.ok) {
                throw new Error(
                    "Gagal mengunduh hasil Edit Foto."
                );
            }

            const bufferHasil = Buffer.from(
                await responseGambar.arrayBuffer()
            );
         const fileHasil = new File(
    [bufferHasil],
    namaFile,
    {
        type:
            responseGambar.headers.get("content-type") ||
            "image/png"
    }
);

const urlHasilPermanen =
    await fal.storage.upload(fileHasil);

console.log(
    "Hasil foto diunggah ke fal:",
    urlHasilPermanen
);
            fs.writeFileSync(
                lokasiFile,
                bufferHasil
            );

            console.log(
                "Edit Foto berhasil:",
                namaFile
            );

            return res.json({
    success: true,
    message:
        "Foto berhasil diedit dengan fal.ai.",

    imageUrl: urlHasilPermanen,

    fileName: namaFile
});
        } catch (error) {
            console.error("");
            console.error(
                "Kesalahan Edit Foto fal.ai:",
                error
            );

            let pesan =
                error?.body?.detail ||
                error?.message ||
                "Edit Foto gagal diproses.";

            if (typeof pesan !== "string") {
                pesan = JSON.stringify(pesan);
            }

            const pesanKecil =
                pesan.toLowerCase();

            if (
                pesanKecil.includes("credit") ||
                pesanKecil.includes("billing") ||
                pesanKecil.includes("payment")
            ) {
                pesan =
                    "Saldo fal.ai belum tersedia atau tidak mencukupi.";
            }

            if (
                pesanKecil.includes("unauthorized") ||
                pesanKecil.includes("invalid key") ||
                pesanKecil.includes("401")
            ) {
                pesan =
                    "FAL_KEY tidak valid atau belum terbaca.";
            }

            return res.status(500).json({
                success: false,
                message: pesan
            });
        }
    }
);
app.post(
    "/hapus-background",

    function (req, res, next) {
        console.log("🔥 REQUEST MASUK KE /hapus-background");
        next();
    },

    upload.single("photo"),

    async function (req, res) {
        let fileInput = null;
        let fileOutput = null;

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Foto belum dipilih."
                });
            }

            console.log("Memulai Hapus Background...");

            const segmenter =
                await dapatkanModnetSegmenter();

            const ext =
                path.extname(req.file.originalname) || ".jpg";

            const idFile =
                Date.now();

            fileInput = path.join(
                folderVideo,
                `hapus-bg-input-${idFile}${ext}`
            );

            fileOutput = path.join(
                folderVideo,
                `nivexa-transparan-${idFile}.png`
            );

            fs.writeFileSync(
                fileInput,
                req.file.buffer
            );

            console.log(
                "Memproses background..."
            );

           const hasil =
    await segmenter(fileInput);

await hasil.save(fileOutput);

            console.log(
                "Hapus Background berhasil."
            );

            if (fs.existsSync(fileInput)) {
                fs.unlinkSync(fileInput);
                fileInput = null;
            }
            const urlHasil =
    "/generated/" + path.basename(fileOutput);

res.setHeader(
    "X-Result-Url",
    urlHasil
);
            return res.sendFile(
                fileOutput,
                function (error) {

                    if (error) {
                        console.error(
                            "Gagal mengirim hasil:",
                            error
                        );
                    }
                }
            );

        } catch (error) {

            console.error(
                "Hapus Background gagal:",
                error
            );

            if (fileInput &&
                fs.existsSync(fileInput)) {

                fs.unlinkSync(fileInput);
            }


            return res.status(500).json({
                success: false,
                message:
                    error?.message ||
                    "Hapus Background gagal diproses."
            });
        }
    }
);
app.post(
    "/generate-video",
    upload.single("photo"),

    async function (req, res) {
        try {
            const prompt =
                typeof req.body.prompt === "string"
                    ? req.body.prompt.trim()
                    : "";

            if (!process.env.HF_TOKEN) {
                return res.status(500).json({
                    success: false,
                    message:
                        "HF_TOKEN belum terbaca dari file .env."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Foto belum dipilih."
                });
            }

            if (!prompt) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Prompt gerakan belum diisi."
                });
            }

            console.log("");
            console.log("================================");
            console.log("Memulai pembuatan video NIVEXA AI");
            console.log("Foto:", req.file.originalname);
            console.log("Ukuran:", req.file.size, "bytes");
            console.log("Prompt:", prompt);
            console.log("================================");

            const {
                Client,
                handle_file
            } = await import("@gradio/client");

            console.log(
                "Menghubungkan ke Hugging Face Space..."
            );

            const gradioApp = await Client.connect(
                HF_SPACE,
                {
                    token: process.env.HF_TOKEN
                }
            );

            const seed = Math.floor(
                Math.random() * 2147483647
            );

            const randomizeSeed = true;

            // Nilai umum Stable Video Diffusion.
            const motionBucketId = 127;

            // Space menghasilkan sekitar 25 frame.
            const framesPerSecond = 6;

            const imageBlob = new Blob(
                [req.file.buffer],
                {
                    type: req.file.mimetype
                }
            );

            console.log(
                "Foto dikirim ke endpoint /video..."
            );

            const hasil = await gradioApp.predict(
                "/video",
                [
                    handle_file(imageBlob),
                    seed,
                    randomizeSeed,
                    motionBucketId,
                    framesPerSecond
                ]
            );

            console.log(
                "Respons Gradio diterima."
            );

            const urlMentah = cariUrlVideo(hasil.data);

            if (!urlMentah) {
                console.log(
                    "Isi respons:",
                    JSON.stringify(hasil.data, null, 2)
                );

                throw new Error(
                    "URL video tidak ditemukan dalam respons AI."
                );
            }

            const urlVideoAI =
                buatUrlLengkap(urlMentah);

            const namaVideo =
                `nivexa-${Date.now()}.mp4`;

            const lokasiVideo =
                path.join(folderVideo, namaVideo);

            console.log(
                "Mengunduh video hasil AI..."
            );

            await unduhVideo(
                urlVideoAI,
                lokasiVideo
            );

            const alamatVideoLokal =
                `/generated/${namaVideo}`;

            console.log(
                "Video berhasil disimpan:",
                namaVideo
            );

            return res.json({
                success: true,
                message:
                    "Video AI berhasil dibuat.",
                videoUrl: alamatVideoLokal,
                fileName: namaVideo,
                demo: false,

                info:
                    "Model Stable Video Diffusion saat ini " +
                    "menggerakkan foto tanpa membaca prompt " +
                    "secara langsung."
            });
        } catch (error) {
            console.error("");
            console.error(
                "Kesalahan pembuatan video:",
                error
            );

            const pesanAsli =
                error?.message ||
                "Video AI gagal dibuat.";

            const pesanKecil =
                pesanAsli.toLowerCase();

            if (
                pesanKecil.includes("queue") ||
                pesanKecil.includes("busy") ||
                pesanKecil.includes("capacity") ||
                pesanKecil.includes("rate limit") ||
                pesanKecil.includes("429")
            ) {
                return res.status(503).json({
                    success: false,
                    message:
                        "Server AI gratis sedang penuh atau " +
                        "antre. Silakan coba lagi beberapa saat."
                });
            }

            if (
                pesanKecil.includes("401") ||
                pesanKecil.includes("unauthorized") ||
                pesanKecil.includes("token")
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Token Hugging Face tidak valid atau " +
                        "belum memiliki izin."
                });
            }

            if (
                pesanKecil.includes("sleep") ||
                pesanKecil.includes("starting")
            ) {
                return res.status(503).json({
                    success: false,
                    message:
                        "Mesin AI sedang dinyalakan. " +
                        "Tunggu sebentar lalu coba lagi."
                });
            }

            return res.status(500).json({
                success: false,
                message: pesanAsli
            });
        }
    }
);

app.use(function (error, req, res, next) {
    console.error(
        "Kesalahan server:",
        error
    );

    if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Ukuran foto maksimal 10 MB."
        });
    }

    return res.status(500).json({
        success: false,
        message:
            error.message ||
            "Terjadi masalah pada server."
    });
});

app.listen(
    PORT,
    "0.0.0.0",

    function () {
        console.log("");
        console.log("================================");
        console.log("NIVEXA AI SERVER AKTIF");
        console.log("================================");

        console.log(
            "HF token:",
            process.env.HF_TOKEN
                ? "sudah terbaca"
                : "belum terbaca"
        );

        console.log(
            `Server laptop: http://localhost:${PORT}`
        );

        console.log(
            `Tes status: http://localhost:${PORT}/status`
        );

        console.log("================================");
        console.log("");
    }
);