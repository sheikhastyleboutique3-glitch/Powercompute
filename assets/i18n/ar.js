/**
 * PowerCompute — Arabic (Modern Standard) translation dictionary.
 * See en.js for structure/key notes. This is a right-to-left (RTL)
 * language — assets/js/i18n.js flips <html dir="rtl"> and swaps in an
 * Arabic-friendly font stack whenever this dictionary is active.
 */
window.PC_I18N_AR = {
  meta: {
    dir: "rtl",
    langLabel: "AR",
    fontFamily: "'Noto Kufi Arabic', 'Cairo', ui-sans-serif, system-ui"
  },

  common: {
    connectWallet: "ربط المحفظة",
    language: "اللغة",
    nav: {
      protocol: "البروتوكول",
      yieldCalculator: "حاسبة العائد",
      liveGrid: "الشبكة المباشرة",
      staking: "التخزين",
      roadmap: "خارطة الطريق",
      news: "الأخبار",
      nodeDashboard: "لوحة العُقد",
      leaderboard: "لوحة المتصدرين",
      governance: "الحوكمة",
      home: "الرئيسية",
      adminConsole: "لوحة المالك",
      restrictedConsole: "لوحة مقيدة الوصول"
    },
    footer: {
      rights: "© 2026 بروتوكول PowerCompute. جميع الحقوق محفوظة.",
      testnetNotice: "يتم نشر $PWR على شبكة اختبار عامة لأغراض العرض فقط. رموز الاختبار لا تحمل أي قيمة مالية. يرجى دائمًا التحقق من عناوين العقود بشكل مستقل قبل التفاعل معها.",
      testnetShort: "برنامج تجريبي على شبكة اختبار — غير مخصص لأموال حقيقية.",
      ecosystem: "المنظومة",
      resources: "الموارد",
      community: "المجتمع",
      github: "GitHub",
      documentation: "الوثائق",
      explorer: "مستكشف BaseScan",
      twitter: "X / تويتر",
      discord: "Discord",
      telegram: "Telegram"
    },
    wallet: {
      connectTitle: "ربط محفظة",
      injectedTitle: "امتداد المتصفح",
      injectedSubtitle: "MetaMask، Coinbase Wallet، Rabby، وغيرها",
      walletConnectTitle: "WalletConnect",
      walletConnectSubtitle: "مسح رمز QR بأي تطبيق محفظة على الهاتف",
      pickerFooterNote: "على الهاتف بدون امتداد محفظة في المتصفح، اختر WalletConnect.",
      accountTitle: "المحفظة",
      connectedAddress: "العنوان المتصل",
      copy: "نسخ",
      explorer: "المستكشف",
      disconnect: "قطع الاتصال",
      addressCopied: "تم نسخ العنوان إلى الحافظة!",
      copyFailed: "تعذر النسخ تلقائيًا — العنوان معروض أعلاه.",
      disconnected: "تم قطع اتصال المحفظة."
    }
  },

  pages: {
    dashboard: {
      title: "لوحة تحكم مشغّل العُقد — PowerCompute ($PWR)",
      badge: "وحدة تحكم مشغّل العُقد",
      heading: "لوحة العُقد",
      subtitle: "سجّل عُقد GPU، وقدّم تقارير إثبات استهلاك الطاقة (PoEC)، وتابع مكافآت $PWR الخاصة بك."
    },
    governance: {
      title: "الحوكمة — PowerCompute ($PWR)",
      badge: "حوكمة موزونة بالتخزين",
      heading: "الحوكمة"
    },
    leaderboard: {
      title: "لوحة المتصدرين — PowerCompute ($PWR)",
      badge: "أفضل المساهمين",
      heading: "لوحة المتصدرين"
    },
    admin: {
      title: "لوحة الإدارة — PowerCompute ($PWR)"
    }
  },

  index: {
    title: "PowerCompute ($PWR) — بروتوكول تنسيق الطاقة إلى الحوسبة اللامركزي",
    description: "يوجّه PowerCompute ($PWR) الطاقة الخضراء المهدرة نحو طلب حوسبة الذكاء الاصطناعي المُتحقَّق منه. قم بالتخزين، حساب العائد، تسجيل عُقد GPU، والانضمام إلى الشبكة التجريبية.",

    hero: {
      badge: "الشبكة التجريبية نشطة — Base Sepolia",
      title1: "تشغيل الجيل القادم من",
      titleAi: "الذكاء الاصطناعي",
      titleWith: "باستخدام",
      title2: "الطاقة الخضراء المهدرة",
      subtitlePre: "PowerCompute هي طبقة تنسيق لامركزية توجّه الطاقة المتجددة المُقيَّدة من مزارع الرياح والطاقة الشمسية مباشرةً إلى حوسبة GPU مُتحقَّق منها وحسب الطلب لأعباء عمل الذكاء الاصطناعي — لتحويل الإلكترونات المهدرة إلى ذكاء، ومكافأة المشغّلين بعملة",
      exploreEcosystem: "استكشف المنظومة"
    },

    metrics: {
      energyRouted: "إجمالي الطاقة المُوجَّهة (كيلوواط/ساعة)",
      activeNodes: "العُقد النشطة على الشبكة",
      totalStaked: "إجمالي $PWR المُخزَّن",
      tvl: "إجمالي القيمة المُقفَلة",
      simulatedNote: "يتم عرض بيانات تجريبية محاكاة — قم بنشر العقود وضبط assets/js/config.js لعرض بيانات مباشرة من السلسلة.",
      liveNote: "بيانات مباشرة من السلسلة من NodeRegistry و PowerComputeToken على Base Sepolia."
    },

    presale: {
      title: "إنجاز تمويل المنظومة",
      subtitle: "البيع العام المسبق ومجمع منح المنظومة —",
      nextPhaseIn: "المرحلة السعرية التالية بعد",
      raised: "تم جمعه:",
      goal: "الهدف:",
      phaseLabel: "المرحلة 1 · العُقد الأولى",
      currentPrice: "السعر الحالي",
      nextPrice: "سعر المرحلة التالية",
      contributors: "المساهمون",
      referredBy: "تمت إحالتك من قبل",
      referredBonus: "— سيحصل كلاكما على مكافأة عند هذه المساهمة.",
      ethPlaceholder: "قيمة ETH للمساهمة",
      contributeBtn: "المساهمة في البيع المسبق",
      claimBtn: "استلام $PWR الخاص بي"
    },

    calculator: {
      title1: "معالج الذكاء الاصطناعي",
      titleVs: "مقابل",
      title2: "حاسبة عائد الطاقة الخضراء",
      subtitle: "قم بمحاكاة عدد عُقد GPU من فئة H100/A100 التي ستشغّلها وشاهد التوفير المتوقع في الطاقة، وخفض الكربون، ومكافآت $PWR.",
      gpuNodesLabel: "عُقد GPU (H100 / A100)",
      oneNode: "عُقدة واحدة",
      hundredNodes: "100 عُقدة",
      curtailmentPrice: "متوسط سعر تقييد الشبكة ($/ميجاواط ساعة)",
      computeRate: "سعر سوق الحوسبة ($/ميجاواط ساعة مكافئ)",
      disclaimer: "تفترض التقديرات أن كل عُقدة H100/A100 تستهلك حوالي 1.6 كيلوواط تحت حمل استدلال/تدريب ذكاء اصطناعي مستمر، من طاقة متجددة مهدرة كان سيتم تقييدها. الأرقام توضيحية وليست ضمانات مالية. سجّل عُقدة حقيقية وقدّم إثباتات طاقة على",
      disclaimerLink: "لوحة العُقد",
      disclaimerEnd: "لكسب $PWR فعلي.",
      daily: "يوميًا",
      monthly: "شهريًا",
      energySavings: "توفير الطاقة (كيلوواط ساعة/يوم)",
      carbonOffset: "خفض الكربون (طن CO₂)",
      pwrRewards: "مكافآت $PWR المكتسبة",
      netRevenue: "الإيراد الصافي التقديري (دولار)"
    },

    chart: {
      title: "تقييد الشبكة الفوري مقابل طلب حوسبة الذكاء الاصطناعي",
      subtitle: "بيانات محاكاة مباشرة من عُقد تنسيق PowerCompute",
      curtailedEnergy: "الطاقة المُقيَّدة",
      computeDemand: "طلب الحوسبة"
    },

    staking: {
      title: "بوابة التخزين والاستخدام",
      subtitle: "قم بربط محفظتك لعرض الأرصدة المباشرة وتخزين $PWR لكسب نسبة من مُصدرات البروتوكول.",
      walletOverview: "نظرة عامة على المحفظة",
      pwrBalance: "رصيد $PWR",
      ethBalance: "رصيد ETH (Base Sepolia)",
      currentlyStaked: "المُخزَّن حاليًا",
      pendingRewards: "المكافآت المُعلَّقة",
      notePre: "قم بربط محفظة على",
      noteMid: "لقراءة الأرصدة المباشرة من السلسلة عبر عقد $PWR المنشور. حدّث عناوين العقود الثلاثة في",
      notePost: "بعد النشر.",
      tabStake: "تخزين",
      tabUnstake: "إلغاء التخزين",
      amountToStake: "المبلغ المراد تخزينه",
      stakeBtn: "تخزين $PWR",
      apr: "معدل العائد السنوي (تقديري)",
      lockup: "فترة القفل",
      lockupNone: "لا يوجد",
      rewardToken: "رمز المكافأة",
      amountToUnstake: "المبلغ المراد إلغاء تخزينه",
      unstakeBtn: "إلغاء تخزين $PWR",
      claimRewardsBtn: "استلام المكافآت المُعلَّقة"
    },

    howItWorks: {
      title: "كيف يعمل النظام",
      subtitle: "ثلاث خطوات قابلة للتحقق تحوّل الإلكترونات المهدرة إلى حوسبة ذكاء اصطناعي لامركزية.",
      step1Title: "رصد تقييد الشبكة",
      step1Body: "تحدّد أجهزة الاستشعار المرتبطة بالمُنسِّق الطاقة المتجددة المهدرة/المُقيَّدة في مواقع الرياح والطاقة الشمسية في الوقت الفعلي، قبل أن تُهدر أو تُقيَّد من قبل الشبكة.",
      step2Title: "التحقق من العُقدة (PoEC)",
      step2Body1: "يسجّل مشغّلو عُقد GPU على",
      step2Link: "لوحة العُقد",
      step2Body2: "ويقدّمون تقارير إثبات استهلاك الطاقة (PoEC)، والتي يتم التحقق منها على السلسلة من قبل مُحكِّمي البروتوكول عبر",
      step3Title: "تنسيق حوسبة الذكاء الاصطناعي",
      step3Body: "تُوجَّه الطاقة الخضراء المُتحقَّق منها إلى مهام تدريب/استدلال الذكاء الاصطناعي عبر سوق PowerCompute، ويُكافأ المشغّلون بعملة $PWR تُسك مباشرة إلى محافظهم."
    },

    roadmap: {
      title: "خارطة طريق البروتوكول",
      subtitle: "من التحقق على الشبكة التجريبية إلى التوسع الكامل لمحطة الطاقة الافتراضية (VPP).",
      q1Title: "إطلاق الشبكة التجريبية وضم العُقد",
      q1Item1: "نشر عقود رمز $PWR و NodeRegistry والبيع المسبق على شبكة Base Sepolia التجريبية",
      q1Item2: "ضم أول 250 عُقدة GPU تجريبية عبر 3 مواقع طاقة متجددة من خلال لوحة العُقد",
      q1Item3: "إطلاق الإصدار الأول من شبكة مُحكِّمي إثبات استهلاك الطاقة (PoEC)",
      q1Item4: "برنامج مكافآت اكتشاف الأخطاء العام وتدقيق عقود ذكية من طرف ثالث",
      q2Title: "فعالية إصدار الرمز (TGE) والشبكة الرئيسية",
      q2Item1: "فعالية إصدار رمز $PWR مع ربط السيولة في البورصات المركزية واللامركزية",
      q2Item2: "النشر على الشبكة الرئيسية لـ Base مع جسر عبر السلاسل إلى Ethereum L1",
      q2Item3: "تفعيل وحدة الحوكمة — يصوّت حاملو $PWR على معدلات الإصدار",
      q2Item4: "برنامج ضم مشغّلي GPU المؤسسيين (هدف 500+ عُقدة)",
      q3Title: "التوسع في محطة الطاقة الافتراضية (VPP)",
      q3Item1: "تجميع العُقد الموزعة في محطة طاقة افتراضية لامركزية",
      q3Item2: "عقود استجابة الطلب مع شركاء المرافق الإقليميين",
      q3Item3: "سوق حوسبة الذكاء الاصطناعي الإصدار 2 — تسعير فوري وآجل لساعات GPU",
      q3Item4: "التوسع في أكثر من 10 ممرات طاقة متجددة جديدة عالميًا",
      q4Title: "اللامركزية الكاملة وتسليم إدارة DAO",
      q4Item1: "خزينة البروتوكول والمُصدرات تحت حوكمة كاملة من PowerCompute DAO",
      q4Item2: "التنازل عن ملكية العقود الأساسية بعد التدقيق النهائي",
      q4Item3: "إصدار مفتوح المصدر لكامل منظومة التنسيق والمُحكِّمين",
      q4Item4: "برنامج إعادة شراء وتخزين $PWR طويل الأمد مموَّل من عائدات البروتوكول"
    },

    tokenomics: {
      title: "تفاصيل اقتصاديات الرمز",
      subtitlePre: "عرض أقصى ثابت يبلغ",
      subtitlePost: "— بدون تضخم غير محدود.",
      nodeRewards: "مكافآت العُقد",
      stakingPool: "مجمع التخزين",
      ecosystemGrants: "المنظومة والمنح",
      teamAdvisors: "الفريق والمستشارون",
      liquidityCex: "السيولة والبورصات المركزية",
      maxSupply: "العرض الأقصى",
      circulatingSupply: "العرض المتداول",
      network: "الشبكة",
      networkValue: "Base (الشبكة التجريبية Sepolia)",
      teamVesting: "استحقاق الفريق",
      teamVestingValue: "استحقاق خطي على 24 شهرًا، فترة تجميد 6 أشهر"
    },

    news: {
      title: "أخبار وإعلانات البروتوكول",
      subtitle: "تُنشر مباشرةً على السلسلة من قبل فريق PowerCompute — بلا خادم، بلا قاعدة بيانات، وقابلة للتحقق بالكامل.",
      loading: "جاري تحميل الإعلانات...",
      demoNote: "يتم عرض إعلانات توضيحية تجريبية — قم بنشر PowerComputeAnnouncements.sol وضبطه لنشر مقالات حقيقية على السلسلة.",
      empty: "لم يتم نشر أي إعلانات بعد.",
      readMore: "قراءة المزيد"
    },

    footer: {
      description: "PowerCompute هو بروتوكول شبكة بنية تحتية فيزيائية لامركزية (DePIN) يربط الطاقة المتجددة المهدرة بطلب حوسبة الذكاء الاصطناعي المُتحقَّق منه. $PWR هو رمز مرافق وحوكمة؛ وهو ليس عقد استثمار أو أوراقًا مالية. لا شيء في هذا الموقع يُعد نصيحة مالية.",
      tokenLabel: "الرمز:",
      notDeployed: "لم يُنشر بعد",
      copyrightLine: "© 2026 بروتوكول PowerCompute. جميع الحقوق محفوظة. ·",
      ownerConsole: "لوحة المالك",
      testnetDisclaimer: "يتم نشر $PWR على شبكة اختبار عامة لأغراض العرض فقط. رموز الاختبار لا تحمل أي قيمة مالية. يرجى دائمًا التحقق من عناوين العقود بشكل مستقل قبل التفاعل معها."
    }
  }
};
