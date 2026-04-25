import { useEffect, useMemo, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const channels = ["WhatsApp", "Facebook", "Email", "Guest / Non-Banking Customer"];
const priorities = ["Low", "Medium", "High"];
const statuses = ["New", "Escalated", "Resolved", "In Progress"];
const languages = [
  "English",
  "Roman Urdu",
  "Urdu",
  "Arabic",
  "Hindi",
  "French",
  "Spanish",
  "German",
  "Turkish",
  "Chinese",
  "Indonesian",
  "Malay",
  "Bengali",
  "Persian"
];

const mockCnicDB = {
  "3520212345671": "Hassan sheik",
  "3520212345672": "Usman Mirza",
  "6110112345673": "Haroon Malik",
  "6110112345675": "Wasi CH",
};

const triageRules = [
  {
    keywords: ["double transfer", "amount not received", "unauthorized access"],
    category: "Fraud / Transfer Issue",
    priority: "High",
    department: "Account Services / Operations",
    sla: "2-4 hours"
  },
  {
    keywords: ["card", "atm", "limit", "block"],
    category: "Card Issue",
    priority: "Medium",
    department: "Card Operations",
    sla: "8-24 hours"
  },
  {
    keywords: ["bill payment", "reversal", "timeout", "otp"],
    category: "Payment Issue",
    priority: "High",
    department: "Payments Team",
    sla: "4-8 hours"
  },
  {
    keywords: ["account", "statement", "dormancy", "raast"],
    category: "Account Query",
    priority: "Medium",
    department: "Account Services",
    sla: "24 hours"
  }
];

const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isValidGuestContact = (value = "") => {
  const input = value.trim();
  const mobilePattern = /^(03\d{9}|\+923\d{9}|923\d{9})$/;
  return mobilePattern.test(input) || isValidEmail(input);
};

const localizedReplies = {
  English: {
    smallTalk:
      "Hello! I can help you register banking complaints like card issues, OTP issues, failed transfers, Raast issues, account problems, or fraud complaints. Please tell me your issue.",
    nonBanking:
      "Please share your banking complaint, for example card activation issue, OTP issue, transfer not received, bill payment issue, or fraud complaint.",
    analyzed:
      "Your complaint has been analyzed. Please review the summary and click Register Complaint."
  },
  "Roman Urdu": {
    smallTalk:
      "Hello! Main aapki banking complaint register karne me help kar sakta hun, jaise card issue, OTP issue, transfer fail, Raast issue, account issue ya fraud complaint. Aap apna issue batayein.",
    nonBanking:
      "Please apni banking complaint batayein, jaise card activate nahi ho raha, OTP nahi aa raha, paisa transfer hua lekin receive nahi hua, bill payment issue, ya fraud complaint.",
    analyzed:
      "Aapki complaint analyze ho gayi hai. Summary review karein aur Register Complaint par click karein."
  },
  Urdu: {
    smallTalk:
      "السلام علیکم! میں آپ کی بینکنگ شکایت درج کرنے میں مدد کر سکتا ہوں۔ براہ کرم اپنا مسئلہ بتائیں۔",
    nonBanking:
      "براہ کرم اپنی بینکنگ شکایت بتائیں، جیسے کارڈ ایکٹیویشن، او ٹی پی، ٹرانسفر، بل پیمنٹ یا فراڈ کا مسئلہ۔",
    analyzed:
      "آپ کی شکایت کا تجزیہ مکمل ہو گیا ہے۔ براہ کرم خلاصہ دیکھیں اور رجسٹر شکایت پر کلک کریں۔"
  },
  Arabic: {
    smallTalk:
      "مرحباً! يمكنني مساعدتك في تسجيل الشكاوى البنكية مثل مشاكل البطاقة وOTP والتحويلات وراست والاحتيال. من فضلك اذكر مشكلتك.",
    nonBanking:
      "يرجى مشاركة شكوى بنكية مثل مشكلة تفعيل البطاقة أو OTP أو تحويل لم يصل أو مشكلة دفع فاتورة أو احتيال.",
    analyzed:
      "تم تحليل شكواك. يرجى مراجعة الملخص ثم الضغط على تسجيل الشكوى."
  },
  Hindi: {
    smallTalk:
      "नमस्ते! मैं कार्ड, OTP, ट्रांसफर, Raast, अकाउंट और फ्रॉड जैसी बैंकिंग शिकायत दर्ज करने में मदद कर सकता हूँ। कृपया अपनी समस्या बताएं।",
    nonBanking:
      "कृपया अपनी बैंकिंग शिकायत बताएं, जैसे कार्ड एक्टिवेशन, OTP, ट्रांसफर न मिलना, बिल पेमेंट समस्या या फ्रॉड शिकायत।",
    analyzed:
      "आपकी शिकायत का विश्लेषण हो गया है। कृपया सारांश देखें और Register Complaint पर क्लिक करें।"
  },
  French: {
    smallTalk:
      "Bonjour ! Je peux vous aider a enregistrer des plaintes bancaires: carte, OTP, virement, Raast, compte ou fraude. Merci de decrire votre probleme.",
    nonBanking:
      "Veuillez partager une plainte bancaire, par exemple activation de carte, probleme OTP, virement non recu, paiement de facture ou fraude.",
    analyzed:
      "Votre plainte a ete analysee. Veuillez verifier le resume puis cliquer sur Register Complaint."
  },
  Spanish: {
    smallTalk:
      "Hola. Puedo ayudarte a registrar quejas bancarias sobre tarjeta, OTP, transferencias, Raast, cuenta o fraude. Por favor, indica tu problema.",
    nonBanking:
      "Comparte una queja bancaria, por ejemplo activacion de tarjeta, problema OTP, transferencia no recibida, pago de factura o fraude.",
    analyzed:
      "Tu queja fue analizada. Revisa el resumen y luego haz clic en Register Complaint."
  },
  German: {
    smallTalk:
      "Hallo! Ich kann bei Bankbeschwerden helfen, z. B. Karte, OTP, Ueberweisung, Raast, Konto oder Betrug. Bitte beschreibe dein Problem.",
    nonBanking:
      "Bitte teile eine Bankbeschwerde mit, z. B. Kartenaktivierung, OTP-Problem, Ueberweisung nicht erhalten, Rechnungszahlung oder Betrug.",
    analyzed:
      "Ihre Beschwerde wurde analysiert. Bitte pruefen Sie die Zusammenfassung und klicken Sie auf Register Complaint."
  },
  Turkish: {
    smallTalk:
      "Merhaba! Kart, OTP, transfer, Raast, hesap veya dolandiricilik gibi bankacilik sikayetlerini kaydetmenize yardim edebilirim. Lutfen sorununuzu yazin.",
    nonBanking:
      "Lutfen kart aktivasyonu, OTP sorunu, ulasmayan transfer, fatura odeme sorunu veya dolandiricilik gibi bankacilik sikayetinizi paylasin.",
    analyzed:
      "Sikayetiniz analiz edildi. Ozeti inceleyip Register Complaint dugmesine basin."
  },
  Chinese: {
    smallTalk:
      "您好！我可以帮助您登记银行卡、OTP、转账、Raast、账户或欺诈相关的银行投诉。请说明您的问题。",
    nonBanking:
      "请提供银行投诉，例如卡片激活问题、OTP问题、转账未到账、账单支付问题或欺诈投诉。",
    analyzed:
      "您的投诉已完成分析。请查看摘要并点击 Register Complaint。"
  },
  Indonesian: {
    smallTalk:
      "Halo! Saya dapat membantu mendaftarkan keluhan perbankan seperti masalah kartu, OTP, transfer, Raast, akun, atau penipuan. Silakan jelaskan masalah Anda.",
    nonBanking:
      "Silakan kirim keluhan perbankan, misalnya aktivasi kartu, OTP, transfer belum diterima, pembayaran tagihan, atau penipuan.",
    analyzed:
      "Keluhan Anda sudah dianalisis. Silakan tinjau ringkasan lalu klik Register Complaint."
  },
  Malay: {
    smallTalk:
      "Hai! Saya boleh bantu daftarkan aduan perbankan seperti isu kad, OTP, pemindahan, Raast, akaun atau penipuan. Sila terangkan masalah anda.",
    nonBanking:
      "Sila kongsi aduan perbankan seperti pengaktifan kad, isu OTP, pemindahan tidak diterima, isu bayaran bil atau penipuan.",
    analyzed:
      "Aduan anda telah dianalisis. Sila semak ringkasan dan klik Register Complaint."
  },
  Bengali: {
    smallTalk:
      "হ্যালো! কার্ড, OTP, ট্রান্সফার, Raast, অ্যাকাউন্ট বা জালিয়াতি সংক্রান্ত ব্যাংকিং অভিযোগ নিবন্ধনে আমি সাহায্য করতে পারি। দয়া করে সমস্যাটি বলুন।",
    nonBanking:
      "অনুগ্রহ করে ব্যাংকিং অভিযোগ দিন, যেমন কার্ড অ্যাক্টিভেশন, OTP সমস্যা, ট্রান্সফার না পাওয়া, বিল পেমেন্ট সমস্যা বা জালিয়াতি অভিযোগ।",
    analyzed:
      "আপনার অভিযোগ বিশ্লেষণ করা হয়েছে। অনুগ্রহ করে সারাংশ দেখে Register Complaint চাপুন।"
  },
  Persian: {
    smallTalk:
      "سلام! من می توانم برای ثبت شکایت بانکی مثل کارت، OTP، انتقال وجه، Raast، حساب یا تقلب کمک کنم. لطفا مشکل خود را بگویید.",
    nonBanking:
      "لطفا شکایت بانکی خود را ارسال کنید، مثل مشکل فعال سازی کارت، OTP، نرسیدن انتقال، پرداخت قبض یا تقلب.",
    analyzed:
      "شکایت شما تحلیل شد. لطفا خلاصه را بررسی کرده و روی Register Complaint کلیک کنید."
  }
};

const getLanguageAwareText = (selectedLanguage, key) => {
  if (localizedReplies[selectedLanguage]?.[key]) {
    return localizedReplies[selectedLanguage][key];
  }
  return localizedReplies.English[key];
};

const fallbackFromText = (complaintText, selectedLanguage = "English") => {
  const text = complaintText.toLowerCase();
  const matched = triageRules.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword))
  );
  const amountMatch = complaintText.match(/(?:pkr|rs\.?|usd|amount)?\s*(\d{3,})/i);
  const refMatch = complaintText.match(/(?:txn|trx|ref|reference|id)\s*[:#-]?\s*([a-z0-9-]{4,})/i);
  const hasDateTime = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|today|yesterday|am|pm|\d{1,2}:\d{2})/i.test(
    complaintText
  );

  const sentiment =
    text.includes("angry") || text.includes("urgent") || text.includes("frustrated")
      ? "Negative"
      : "Neutral";
  const detectedCategory = matched?.category || "General Banking Complaint";
  const missingInformation = [];
  if (!amountMatch) missingInformation.push("Transaction amount");
  if (!hasDateTime) missingInformation.push("Date/time of incident");
  if (!refMatch) missingInformation.push("Transaction/reference ID");

  const categoryReplyMap = {
    "Fraud / Transfer Issue":
      "I can see this looks like a fraud/transfer issue. I am marking it high priority and we should secure your account immediately.",
    "Card Issue":
      "This appears to be a card-related complaint. I will route it to Card Operations with focused verification details.",
    "Payment Issue":
      "This looks like a payment dispute. I will route it to Payments Team and track the transaction trace quickly.",
    "Account Query":
      "This appears to be an account services issue. I will route it to the Account Services queue for action."
  };

  const dynamicReply = categoryReplyMap[detectedCategory]
    ? `${categoryReplyMap[detectedCategory]} ${
        missingInformation.length
          ? `Please share: ${missingInformation.slice(0, 2).join(" and ")}.`
          : "Your provided details look sufficient for registration."
      }`
    : `I understood your complaint and can register it now. ${
        missingInformation.length
          ? `Before submission, please share ${missingInformation.slice(0, 2).join(" and ")}.`
          : "You may proceed to register complaint."
      }`;

  const localizedDynamicReplyByLanguage = {
    "Roman Urdu": `Aapki complaint ${detectedCategory} category mein detect hui hai. Department ${
      matched?.department || "Customer Care Desk"
    } ko route kiya ja raha hai. ${
      missingInformation.length
        ? `Please share: ${missingInformation.slice(0, 2).join(" aur ")}.`
        : "Aap ki details kaafi hain, complaint register ho sakti hai."
    }`,
    Urdu: `آپ کی شکایت ${detectedCategory} کیٹیگری میں شناخت ہوئی ہے۔ اسے ${
      matched?.department || "Customer Care Desk"
    } کو بھیجا جا رہا ہے۔ ${
      missingInformation.length
        ? `براہ کرم یہ معلومات دیں: ${missingInformation.slice(0, 2).join(" اور ")}۔`
        : "آپ کی فراہم کردہ معلومات کافی ہیں، شکایت رجسٹر کی جا سکتی ہے۔"
    }`,
    Arabic: `تم تحديد الشكوى ضمن فئة ${detectedCategory} وتم تحويلها الى ${
      matched?.department || "Customer Care Desk"
    }. ${missingInformation.length ? `يرجى مشاركة: ${missingInformation.slice(0, 2).join(" و ")}.` : "المعلومات الحالية كافية للتسجيل."}`,
    Hindi: `आपकी शिकायत ${detectedCategory} श्रेणी में पहचानी गई है और ${
      matched?.department || "Customer Care Desk"
    } को भेजी जा रही है। ${
      missingInformation.length
        ? `कृपया यह जानकारी दें: ${missingInformation.slice(0, 2).join(" और ")}.`
        : "दी गई जानकारी शिकायत दर्ज करने के लिए पर्याप्त है।"
    }`,
    French: `Votre plainte est detectee dans la categorie ${detectedCategory} et routée vers ${
      matched?.department || "Customer Care Desk"
    }. ${missingInformation.length ? `Merci de partager: ${missingInformation.slice(0, 2).join(" et ")}.` : "Les details sont suffisants pour l'enregistrement."}`,
    Spanish: `Su queja fue detectada en la categoria ${detectedCategory} y se envio a ${
      matched?.department || "Customer Care Desk"
    }. ${missingInformation.length ? `Comparta: ${missingInformation.slice(0, 2).join(" y ")}.` : "Los detalles actuales son suficientes para registrar la queja."}`,
    German: `Ihre Beschwerde wurde als ${detectedCategory} erkannt und an ${
      matched?.department || "Customer Care Desk"
    } weitergeleitet. ${missingInformation.length ? `Bitte teilen Sie mit: ${missingInformation.slice(0, 2).join(" und ")}.` : "Die vorhandenen Angaben sind fuer die Registrierung ausreichend."}`,
    Turkish: `Sikayetiniz ${detectedCategory} kategorisinde tespit edildi ve ${
      matched?.department || "Customer Care Desk"
    } ekibine yonlendirildi. ${
      missingInformation.length
        ? `Lutfen su bilgileri paylasin: ${missingInformation.slice(0, 2).join(" ve ")}.`
        : "Mevcut bilgiler kayit icin yeterli."
    }`,
    Chinese: `您的投诉被识别为 ${detectedCategory}，并已转交给 ${
      matched?.department || "Customer Care Desk"
    }。${missingInformation.length ? `请补充：${missingInformation.slice(0, 2).join("、")}。` : "当前信息足以完成登记。"} `,
    Indonesian: `Keluhan Anda terdeteksi sebagai ${detectedCategory} dan dialihkan ke ${
      matched?.department || "Customer Care Desk"
    }. ${missingInformation.length ? `Mohon kirim: ${missingInformation.slice(0, 2).join(" dan ")}.` : "Informasi saat ini sudah cukup untuk pendaftaran."}`,
    Malay: `Aduan anda dikesan sebagai ${detectedCategory} dan dihantar ke ${
      matched?.department || "Customer Care Desk"
    }. ${missingInformation.length ? `Sila kongsi: ${missingInformation.slice(0, 2).join(" dan ")}.` : "Maklumat semasa mencukupi untuk pendaftaran."}`,
    Bengali: `আপনার অভিযোগ ${detectedCategory} ক্যাটাগরিতে শনাক্ত হয়েছে এবং ${
      matched?.department || "Customer Care Desk"
    } টিমে পাঠানো হয়েছে। ${
      missingInformation.length
        ? `অনুগ্রহ করে দিন: ${missingInformation.slice(0, 2).join(" এবং ")}।`
        : "বর্তমান তথ্য অভিযোগ নিবন্ধনের জন্য যথেষ্ট।"
    }`,
    Persian: `شکایت شما در دسته ${detectedCategory} تشخیص داده شد و به ${
      matched?.department || "Customer Care Desk"
    } ارجاع شد. ${missingInformation.length ? `لطفا ارسال کنید: ${missingInformation.slice(0, 2).join(" و ")}.` : "اطلاعات فعلی برای ثبت شکایت کافی است."}`
  };

  const localizedDynamicReply =
    localizedDynamicReplyByLanguage[selectedLanguage] || dynamicReply;

  return {
    botReply: localizedDynamicReply,
    detectedIntent: detectedCategory,
    category: detectedCategory,
    priority: matched?.priority || "Low",
    sentiment,
    validityRisk: matched?.priority === "High" ? "High" : randomOf(["Low", "Medium"]),
    department: matched?.department || "Customer Care Desk",
    sla: matched?.sla || "24-48 hours",
    evidenceChecklist: [
      "Transaction date and time",
      "Amount involved",
      "Channel used",
      "Screenshot or error message"
    ],
    followUpQuestions: [
      missingInformation[0]
        ? `Please share ${missingInformation[0].toLowerCase()}.`
        : "Please confirm if issue is still active.",
      missingInformation[1]
        ? `Please share ${missingInformation[1].toLowerCase()}.`
        : "Please share any screenshot or error text."
    ],
    missingInformation,
    complaintQualityScore: Math.min(
      95,
      45 +
        (amountMatch ? 15 : 0) +
        (refMatch ? 20 : 0) +
        (hasDateTime ? 10 : 0) +
        (text.length > 60 ? 10 : 0)
    ),
    agentNextBestAction: "Collect evidence and assign to concerned department.",
    englishSummary: `Complaint appears related to ${matched?.category || "general issue"}.`,
    customerReplies: {
      formal:
        "Dear Customer, your complaint has been logged and routed to the concerned department.",
      empathetic:
        "We are sorry for the inconvenience. Your complaint is being handled with priority.",
      whatsapp: "Complaint logged. Our team is working on it."
    },
    fallbackNotice: "Live AI unavailable, offline AI engine used."
  };
};

const isSmallTalk = (text) => {
  const msg = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const phrases = [
    "hi",
    "hello",
    "hey",
    "salam",
    "assalam o alaikum",
    "assalamu alaikum",
    "kaise ho",
    "kese ho",
    "sunao",
    "how are you",
    "what can you do",
    "tm mre kia help kr skty ho",
    "tum meri kya help kar sakte ho"
  ];

  return phrases.some(
    (item) =>
      msg === item || msg.startsWith(`${item} `) || msg.includes(` ${item} `)
  );
};

const isBankingComplaint = (text) => {
  const msg = text.toLowerCase();
  const keywords = [
    "card",
    "atm",
    "otp",
    "transfer",
    "amount",
    "paisa",
    "raast",
    "account",
    "statement",
    "dormant",
    "fraud",
    "unauthorized",
    "bill",
    "payment",
    "reversal",
    "limit",
    "block",
    "unblock",
    "activate",
    "ecommerce",
    "international",
    "delivery",
    "tracking",
    "gum",
    "lost",
    "receive nahi",
    "double"
  ];
  return keywords.some((k) => msg.includes(k));
};

const isLikelyConversation = (text) => {
  const msg = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = msg.split(" ").filter(Boolean);
  if (words.length <= 3 && !isBankingComplaint(msg)) return true;
  return false;
};

const isGenericFallbackBotReply = (text = "") => {
  const msg = text.toLowerCase();
  return (
    msg.includes("thank you for the details") ||
    msg.includes("complaint is registered and assigned") ||
    msg.includes("live ai unavailable, offline ai engine used")
  );
};

const seedComplaints = [
  {
      ticketId: `ISS-${Date.now().toString().slice(-6)}`,
      customerName: "Ali Khan",
      contact: "03001234567",
      cnic: "3520212345671",
      channel: "WhatsApp",
      complaintText: "ATM card blocked and withdrawal limit issue",
      status: "In Progress",
      customerType: "Registered Banking Customer",
      ...fallbackFromText("ATM card blocked and withdrawal limit issue")
  }
];

function App() {
  const savedVerifiedPhone = localStorage.getItem("isscai_verified_phone") || "";
  const [step, setStep] = useState(1);
  const [verification, setVerification] = useState({
    channel: "WhatsApp",
    customerName: "",
    contact: savedVerifiedPhone,
    cnic: "",
    cnicName: "",
    isOtpVerified: false,
    isCnicVerified: false,
  });
  const [analysis, setAnalysis] = useState(null);
  const [complaints, setComplaints] = useState(() => {
    const saved = localStorage.getItem("isscai_complaints");
    return saved ? JSON.parse(saved) : seedComplaints;
  });
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [filters, setFilters] = useState({
    priority: "",
    category: "",
    status: "",
    channel: ""
  });

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const recaptchaVerifierRef = useRef(null);

  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Welcome to ISSCAI. Please share your complaint and I will analyze it."
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [attachmentName, setAttachmentName] = useState("");
  const chatScrollRef = useRef(null);
  const isGuestUser = verification.channel === "Guest / Non-Banking Customer";

  const selectedComplaint =
    complaints.find((item) => item.ticketId === selectedTicketId) || null;
  const categories = useMemo(
    () => [...new Set(complaints.map((c) => c.category))],
    [complaints]
  );
  const filteredComplaints = useMemo(
    () =>
      complaints.filter((item) =>
        (!filters.priority || item.priority === filters.priority) &&
        (!filters.category || item.category === filters.category) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.channel || item.channel === filters.channel)
      ),
    [complaints, filters]
  );
  const customerHistory = useMemo(() => {
    if (!verification.contact) return [];
    return complaints.filter((item) => item.contact === verification.contact);
  }, [complaints, verification.contact]);

  const canProceed = isGuestUser
    ? verification.customerName &&
      verification.contact &&
      isValidGuestContact(verification.contact)
    : verification.customerName &&
      verification.contact &&
      verification.isCnicVerified &&
      verification.isOtpVerified;

  const guestContactError =
    isGuestUser &&
    verification.contact &&
    !isValidGuestContact(verification.contact)
      ? "Please enter a valid mobile number or email."
      : "";

  const getContactFieldConfig = () => {
    if (verification.channel === "WhatsApp") {
      return {
        label: "Registered Mobile Number",
        placeholder: "Enter registered mobile number",
      };
    }

    if (verification.channel === "Guest / Non-Banking Customer") {
      return {
        label: "Mobile Number / Email",
        placeholder: "Enter mobile number or email for complaint follow-up",
      };
    }

    return {
      label: "Registered Mobile Number / Email",
      placeholder: "Enter registered mobile number or email",
    };
  };

  const contactField = getContactFieldConfig();

  const normalizePakistanPhone = (value) => {
    const cleaned = value.replace(/[^\d+]/g, "").trim();
    if (/^03\d{9}$/.test(cleaned)) return `+92${cleaned.slice(1)}`;
    if (/^\+923\d{9}$/.test(cleaned)) return cleaned;
    return null;
  };

  const setupRecaptcha = () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "normal" }
      );
    }
    return recaptchaVerifierRef.current;
  };

  const handleContactChange = (value) => {
    setVerification((v) => ({ ...v, contact: value, isOtpVerified: false }));
    setOtpCode("");
    setOtpSent(false);
    setConfirmationResult(null);
    setOtpMessage("");
    setOtpError("");
  };

  const handleChannelChange = (value) => {
    setVerification((v) => ({
      ...v,
      channel: value,
      cnic: "",
      cnicName: "",
      customerName: value === "Guest / Non-Banking Customer" ? v.customerName : "",
      isOtpVerified: false,
      isCnicVerified: false,
    }));

    setOtpCode("");
    setOtpSent(false);
    setConfirmationResult(null);
    setOtpMessage("");
    setOtpError("");
  };

  const handleVerifyCnic = () => {
    setOtpError("");
    setOtpMessage("");

    const cleanCnic = verification.cnic.replace(/-/g, "").trim();

    if (!/^\d{13}$/.test(cleanCnic)) {
      setOtpError("Invalid CNIC. Enter 13 digit CNIC number.");
      return;
    }

    const matchedName = mockCnicDB[cleanCnic];

    if (!matchedName) {
      setOtpError("CNIC not found in customer records.");
      return;
    }

    setVerification((v) => ({
      ...v,
      cnic: cleanCnic,
      cnicName: matchedName,
      customerName: matchedName,
      isCnicVerified: true,
    }));

    setOtpMessage(`CNIC verified successfully: ${matchedName}`);
  };

  const handleSendOtp = async () => {
    setOtpError("");
    setOtpMessage("");
    const normalizedPhone = normalizePakistanPhone(verification.contact);
    if (!normalizedPhone) {
      setOtpError("Invalid number. Use 03XXXXXXXXX or +923XXXXXXXXX format.");
      return;
    }

    setOtpLoading(true);
    try {
      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
      setConfirmationResult(result);
      setOtpSent(true);
      setOtpMessage("OTP sent successfully");
      setVerification((v) => ({ ...v, contact: normalizedPhone }));
    } catch (error) {
      if (error.code === "auth/invalid-phone-number") {
        setOtpError("Invalid number format.");
      } else if (error.code === "auth/network-request-failed") {
        setOtpError("Network issue. Please try again.");
      } else {
        setOtpError("Unable to send OTP right now.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    setOtpMessage("");
    if (!confirmationResult) {
      setOtpError("Please send OTP first.");
      return;
    }
    if (!otpCode.trim()) {
      setOtpError("Enter OTP code.");
      return;
    }

    setOtpVerifying(true);
    try {
      await confirmationResult.confirm(otpCode.trim());
      setVerification((v) => ({ ...v, isOtpVerified: true }));
      localStorage.setItem("isscai_verified_phone", verification.contact);
      setOtpMessage("Phone verified successfully.");
    } catch {
      setOtpError("OTP verification failed. Please check code and retry.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const sendMessageToAI = async () => {
    const message = chatInput.trim();
    if (!message) return;
    setChatMessages((prev) => [...prev, { sender: "user", text: message }]);
    setChatInput("");

    if (isSmallTalk(message)) {
      setAiResult(null);
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: getLanguageAwareText(selectedLanguage, "smallTalk") }
      ]);
      return;
    }

    if (!isBankingComplaint(message) || isLikelyConversation(message)) {
      setAiResult(null);
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: getLanguageAwareText(selectedLanguage, "nonBanking") }
      ]);
      return;
    }

    setIsTyping(true);

    try {
      const recentUserContext = chatMessages
        .filter((msg) => msg.sender === "user")
        .slice(-4)
        .map((msg) => msg.text)
        .join(" | ");
      const contextAwareMessage = recentUserContext
        ? `${recentUserContext} | ${message}`
        : message;
      const languageDirective = `Always reply ONLY in the selected language: ${selectedLanguage}. Do not use the user's input language unless it matches selected language.`;

      const response = await fetch(`${API_BASE_URL}/api/ai-complaint-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${languageDirective}\n\nCustomer Complaint Context:\n${contextAwareMessage}`,
          language: selectedLanguage,
          customer: verification,
          isGuestUser,
          existingComplaints: complaints
        })
      });

      const data = await response.json();
      const fallbackDraft = fallbackFromText(message, selectedLanguage);
      const normalized =
        data.aiSource === "fallback"
          ? { ...fallbackDraft, ...data }
          : data;

      if (normalized.aiSource === "fallback" && isGenericFallbackBotReply(normalized.botReply)) {
        normalized.botReply = fallbackDraft.botReply;
      }

      setAiResult(normalized);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            normalized.botReply ||
            getLanguageAwareText(selectedLanguage, "analyzed")
        }
      ]);
    } catch {
      const fallback = fallbackFromText(message, selectedLanguage);
      setAiResult(fallback);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            fallback.botReply ||
            getLanguageAwareText(selectedLanguage, "analyzed")
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const registerComplaint = () => {
    const transcript = chatMessages
      .filter((msg) => msg.sender === "user")
      .map((msg) => msg.text)
      .join(" ");
    if (!transcript.trim()) return;

    const fallback = fallbackFromText(transcript, selectedLanguage);
    const result = { ...fallback, ...aiResult };
    const complaint = {
      ...result,
      ticketId: `ISS-${Date.now().toString().slice(-6)}`,
      complaintText: transcript,
      attachmentName,
      customerName: verification.customerName,
      contact: verification.contact,
      channel: verification.channel,
      customerType: isGuestUser
        ? "Guest / Non-Banking Customer"
        : "Registered Banking Customer",
      cnic: isGuestUser ? "N/A" : verification.cnic,
      status: "New",
      createdAt: new Date().toISOString()
    };

    setAnalysis(complaint);
    setComplaints((prev) => [complaint, ...prev]);
    setSelectedTicketId(complaint.ticketId);
    setStep(3);
  };

  const buildTicketShareMessage = (ticket) => {
    if (!ticket) return "";
    return [
      `Ticket ID: ${ticket.ticketId}`,
      `Customer: ${ticket.customerName}`,
      `Category: ${ticket.category}`,
      `Priority: ${ticket.priority}`,
      `Department: ${ticket.department}`,
      `SLA: ${ticket.sla}`,
      "Status: New",
      "Message: Your complaint has been registered. Please share this Ticket ID for future tracking."
    ].join("\n");
  };

  const handleShareTicket = async () => {
    if (!analysis) return;
    const ticketMessage = buildTicketShareMessage(analysis);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "ISSCAI Complaint Ticket",
          text: ticketMessage
        });
        return;
      }

      await navigator.clipboard.writeText(ticketMessage);
      alert("Ticket details copied. You can paste it on WhatsApp or Email.");
    } catch {
      try {
        await navigator.clipboard.writeText(ticketMessage);
        alert("Ticket details copied. You can paste it on WhatsApp or Email.");
      } catch {
        alert("Unable to share ticket right now.");
      }
    }
  };

  const handleDownloadTicket = () => {
    if (!analysis) return;
    const ticketMessage = buildTicketShareMessage(analysis);
    const blob = new Blob([ticketMessage], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ISSCAI-Ticket-${analysis.ticketId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const updateStatus = (status) => {
    if (!selectedComplaint) return;
    setComplaints((prev) =>
      prev.map((item) =>
        item.ticketId === selectedComplaint.ticketId ? { ...item, status } : item
      )
    );
  };

  useEffect(() => {
    localStorage.setItem("isscai_complaints", JSON.stringify(complaints));
  }, [complaints]);

  useEffect(() => {
    if (savedVerifiedPhone) {
      setVerification((v) => ({
        ...v,
        contact: savedVerifiedPhone,
        isOtpVerified: true
      }));
    }
  }, [savedVerifiedPhone]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) recaptchaVerifierRef.current.clear();
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>InnerSight Smart Complaint AI Assistant (ISSCAI)</h1>
          <p>Banking complaint triage MVP</p>
        </div>
        <nav className="steps">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              className={step === s ? "active-step" : ""}
              onClick={() => setStep(s)}
            >
              Step {s}
            </button>
          ))}
        </nav>
      </header>

      {step === 1 && (
        <section className="card">
          <h2>1) Customer Verification</h2>
          <div className="grid-2">
            <label>
              Channel
              <select
                value={verification.channel}
                onChange={(e) => handleChannelChange(e.target.value)}
              >
                {channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </label>
            {!isGuestUser && (
              <label>
                CNIC Number
                <input
                  value={verification.cnic}
                  onChange={(e) =>
                    setVerification((v) => ({
                      ...v,
                      cnic: e.target.value,
                      isCnicVerified: false,
                      cnicName: ""
                    }))
                  }
                  placeholder="35202XXXXXXXXX"
                />
              </label>
            )}
            <label>
              Customer Name
              <input
                value={verification.customerName}
                onChange={(e) =>
                  setVerification((v) => ({ ...v, customerName: e.target.value }))
                }
                placeholder={
                  isGuestUser
                    ? "Enter guest customer name"
                    : "Auto-filled after CNIC verification"
                }
              />
            </label>
            <label>
              {contactField.label}
              <input
                value={verification.contact}
                onChange={(e) => handleContactChange(e.target.value)}
                placeholder={contactField.placeholder}
              />
            </label>
          </div>

          {!isGuestUser && (
            <>
              <div className="actions-row">
                <button onClick={handleVerifyCnic}>Verify CNIC</button>
                {verification.isCnicVerified && (
                  <span className="badge">
                    CNIC Verified: {verification.cnicName}
                  </span>
                )}
              </div>

              <div className="actions-row">
                <button onClick={handleSendOtp} disabled={otpLoading}>
                  {otpLoading ? "Sending..." : "Send OTP"}
                </button>
                {otpSent && (
                  <>
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter OTP"
                    />
                    <button onClick={handleVerifyOtp} disabled={otpVerifying}>
                      {otpVerifying ? "Verifying..." : "Verify OTP"}
                    </button>
                  </>
                )}
                {canProceed && <span className="badge">Verified Customer</span>}
              </div>
              <div id="recaptcha-container"></div>
            </>
          )}
          {isGuestUser && (
            <div className="guest-box">
              <p>
                Guest user can register complaint with limited information only.
              </p>
            </div>
          )}
          {guestContactError && <p className="status-error">{guestContactError}</p>}
          {otpMessage && <p className="status-ok">{otpMessage}</p>}
          {otpError && <p className="status-error">{otpError}</p>}
          <button disabled={!canProceed} onClick={() => setStep(2)}>
            Continue to Complaint Intake
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h2>2) Complaint Intake AI Chat</h2>
          <div className="chat-layout">
            <div className="chat-column">
              <div className="chat-toolbar">
                <label>
                  Language
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="chat-messages" ref={chatScrollRef}>
                {chatMessages.map((msg, index) => (
                  <div
                    key={`${msg.sender}-${index}`}
                    className={`bubble ${msg.sender === "user" ? "user-bubble" : "bot-bubble"}`}
                  >
                    {msg.text}
                  </div>
                ))}
                {isTyping && <div className="typing-indicator">AI is typing...</div>}
              </div>

              <div className="chat-input-row">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your complaint..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessageToAI();
                  }}
                />
                <button onClick={sendMessageToAI}>Send</button>
              </div>
              <label className="upload">
                Optional screenshot / file
                <input
                  type="file"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || "")}
                />
                {attachmentName && <small>Attached: {attachmentName}</small>}
              </label>
              <button onClick={registerComplaint} disabled={!aiResult}>
                Register Complaint
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h2>3) Ticket Generated</h2>
          {!analysis ? (
            <p>No complaint analyzed yet.</p>
          ) : (
            <div className="ticket-summary-card">
              <div className="ticket-header">
                <h3>{analysis.ticketId}</h3>
                <span className={`priority-chip ${analysis.priority?.toLowerCase()}`}>
                  {analysis.priority}
                </span>
              </div>

              <div className="share-ticket-box">
                Your complaint has been registered successfully. Please share this Ticket ID with
                the customer for future tracking.
              </div>

              <p><strong>Ticket ID:</strong> {analysis.ticketId}</p>
              <p><strong>Customer Name:</strong> {analysis.customerName}</p>
              <p><strong>Customer Type:</strong> {analysis.customerType}</p>
              <p><strong>Contact:</strong> {analysis.contact}</p>
              <p><strong>Channel:</strong> {analysis.channel}</p>
              {analysis.cnic && analysis.cnic !== "N/A" && (
                <p><strong>CNIC:</strong> {analysis.cnic}</p>
              )}
              <p><strong>Category:</strong> {analysis.category}</p>
              <p><strong>Priority:</strong> {analysis.priority}</p>
              <p><strong>Sentiment:</strong> {analysis.sentiment}</p>
              <p><strong>Validity Risk:</strong> {analysis.validityRisk}</p>
              <p><strong>Assigned Department:</strong> {analysis.department}</p>
              <p><strong>SLA:</strong> {analysis.sla}</p>
              <p><strong>Quality Score:</strong> {analysis.complaintQualityScore || 0}</p>
              <p><strong>Agent Next Best Action:</strong> {analysis.agentNextBestAction}</p>
              <p><strong>AI Drafted Empathetic Response:</strong> {analysis.customerReplies?.empathetic}</p>

              <div className="ticket-actions">
                <button onClick={handleShareTicket}>Share Ticket</button>
                <button onClick={handleDownloadTicket}>Download Ticket</button>
              </div>
            </div>
          )}
          <button onClick={() => setStep(4)}>Open Complaint Log History</button>
        </section>
      )}

      {step === 4 && (
        <section className="card">
          <h2>4) Complaint Log History</h2>
          <div className="grid-4">
            <label>
              Priority
              <select
                value={filters.priority}
                onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="">All</option>
                {priorities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Channel
              <select
                value={filters.channel}
                onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
              >
                <option value="">All</option>
                {channels.map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="queue">
            {filteredComplaints.map((item) => (
              <article
                key={item.ticketId}
                className={`complaint-card ${selectedTicketId === item.ticketId ? "selected" : ""}`}
                onClick={() => {
                  setSelectedTicketId(item.ticketId);
                }}
              >
                <h3>{item.ticketId}</h3>
                <p>{item.customerName}</p>
                <p>{item.category}</p>
                <p>{item.priority} | {item.status}</p>
                <p>{item.channel}</p>
                <p>{item.customerType}</p>
                <p>CNIC: {item.cnic || "N/A"}</p>
                <p>Risk: {item.validityRisk}</p>
                <p>SLA: {item.sla}</p>
              </article>
            ))}
          </div>

          {verification.contact && (
            <div className="history">
              <h3>Complaint History for {verification.contact}</h3>
              {customerHistory.length === 0 ? (
                <p>No history found for this customer yet.</p>
              ) : (
                customerHistory.map((h) => (
                  <p key={h.ticketId}>
                    {h.ticketId} - {h.category} - {h.status}
                  </p>
                ))
              )}
            </div>
          )}

          {selectedComplaint && (
            <div className="analysis-card">
              <h3>Selected Complaint</h3>
              <p><strong>Ticket:</strong> {selectedComplaint.ticketId}</p>
              <p><strong>Customer:</strong> {selectedComplaint.customerName}</p>
              <p><strong>Customer Type:</strong> {selectedComplaint.customerType}</p>
              <p><strong>CNIC:</strong> {selectedComplaint.cnic || "N/A"}</p>
              <p><strong>Category:</strong> {selectedComplaint.category}</p>
              <p><strong>Priority:</strong> {selectedComplaint.priority}</p>
              <p><strong>Status:</strong> {selectedComplaint.status}</p>
              <p><strong>Department:</strong> {selectedComplaint.department}</p>
              <p><strong>SLA:</strong> {selectedComplaint.sla}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
