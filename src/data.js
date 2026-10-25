/* Программа «Апгрейд» v3 — данные.
   Формат отделён от вёрстки: этот объект станет основой приложения. */
window.PROGRAM = {
  meta: {
    name: "Апгрейд",
    version: "3.2",
    date: "2026-10-25",
    startDefault: "2026-10-26",
    blockWeeks: 5,
    blocks: 3,
    profile: { weight: 80 },
    bodyMenu: ["Суставы и сигналы", "Светофор нагрузки, красные флаги"]
  },

  muscles: {
    biceps:    { n: "Бицепс",          pr: 1 },
    triceps:   { n: "Трицепс",         pr: 1 },
    calves:    { n: "Икры",            pr: 1 },
    sidedelts: { n: "Средняя дельта",  pr: 2 },
    reardelts: { n: "Задняя дельта",   pr: 2 },
    back:      { n: "Спина",           pr: 3 },
    chest:     { n: "Грудь",           pr: 0 },
    quads:     { n: "Квадрицепс",      pr: 0 },
    hams:      { n: "Бицепс бедра",    pr: 0 },
    glutes:    { n: "Ягодичные",       pr: 0 },
    core:      { n: "Кор",             pr: 0 },
    frontdelts:{ n: "Передняя дельта", pr: 0, hide: true },
    adductors: { n: "Приводящие",      pr: 0, hide: true },
    forearms:  { n: "Предплечья",      pr: 0, hide: true }
  },

  sources: {
    pelland26:   { a: "Pelland et al., 2026", t: "The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gains", j: "Sports Medicine 56(2):481–505", u: "https://sportrxiv.org/index.php/server/preprint/view/460" },
    robinson24:  { a: "Robinson et al., 2024", t: "Exploring the dose–response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy", j: "Sports Medicine 54(9):2209–2231", u: "https://doi.org/10.1007/s40279-024-02069-2" },
    maeo23:      { a: "Maeo et al., 2023", t: "Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position", j: "European Journal of Sport Science", u: "https://pubmed.ncbi.nlm.nih.gov/35819335/" },
    maeo21:      { a: "Maeo et al., 2021", t: "Greater hamstrings muscle hypertrophy but similar damage protection after training at long versus short muscle lengths", j: "Med Sci Sports Exerc 53(4)", u: "https://pubmed.ncbi.nlm.nih.gov/33009197/" },
    kinoshita23: { a: "Kinoshita, Maeo et al., 2023", t: "Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training", j: "Frontiers in Physiology 14:1272106", u: "https://doi.org/10.3389/fphys.2023.1272106" },
    kassiano23:  { a: "Kassiano et al., 2023", t: "Greater gastrocnemius muscle hypertrophy after partial range of motion training performed at long muscle lengths", j: "J Strength Cond Res", u: "https://pubmed.ncbi.nlm.nih.gov/37015016/" },
    pedrosa22:   { a: "Pedrosa et al., 2022", t: "Partial range of motion training elicits favorable improvements in muscular adaptations when carried out at long muscle lengths", j: "European Journal of Sport Science 22(8)", u: "https://doi.org/10.1080/17461391.2021.1927199" },
    wolf23:      { a: "Wolf et al., 2023", t: "Partial vs full range of motion resistance training: a systematic review and meta-analysis", j: "International Journal of Strength and Conditioning 3(1)", u: "https://journal.iusca.org/index.php/Journal/article/view/182" },
    plotkin22:   { a: "Plotkin et al., 2022", t: "Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations", j: "PeerJ 10:e14142", u: "https://peerj.com/articles/14142" },
    moesgaard22: { a: "Moesgaard et al., 2022", t: "Effects of periodization on strength and muscle hypertrophy in volume-equated resistance training programs: a systematic review and meta-analysis", j: "Sports Medicine 52", u: "https://pubmed.ncbi.nlm.nih.gov/35044672/" },
    bazvalle19:  { a: "Baz-Valle et al., 2019", t: "The effects of exercise variation in muscle thickness, maximal strength and motivation in resistance trained men", j: "PLoS One 14(12)", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6934277/" },
    kassiano22:  { a: "Kassiano et al., 2022", t: "Does varying resistance exercises promote superior muscle hypertrophy and strength gains? A systematic review", j: "J Strength Cond Res 36(6)", u: "https://doi.org/10.1519/JSC.0000000000004258" },
    zhang25:     { a: "Zhang et al., 2025", t: "Superset versus traditional resistance training prescriptions: a systematic review and meta-analysis", j: "Sports Medicine", u: "https://doi.org/10.1007/s40279-025-02176-8" },
    iversen21:   { a: "Iversen et al., 2021", t: "No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review", j: "Sports Medicine 51", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772/" },
    singer24:    { a: "Singer et al., 2024", t: "Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy", j: "Frontiers in Sports and Active Living 6", u: "https://pubmed.ncbi.nlm.nih.gov/39205815/" },
    afonso21:    { a: "Afonso et al., 2021", t: "Strength training versus stretching for improving range of motion: a systematic review and meta-analysis", j: "Healthcare 9(4):427", u: "https://doi.org/10.3390/healthcare9040427" },
    alizadeh23:  { a: "Alizadeh et al., 2023", t: "Resistance training induces improvements in range of motion: a systematic review and meta-analysis", j: "Sports Medicine 53", u: "https://pubmed.ncbi.nlm.nih.gov/36622555/" },
    schumann22:  { a: "Schumann et al., 2022", t: "Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis", j: "Sports Medicine 52", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8891239/" },
    hickmott22:  { a: "Hickmott et al., 2022", t: "The effect of load and volume autoregulation on muscular strength and hypertrophy: a systematic review and meta-analysis", j: "Sports Medicine – Open 8", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/" },
    bell23:      { a: "Bell et al., 2023", t: "Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach", j: "Sports Medicine – Open 9", u: "https://doi.org/10.1186/s40798-023-00633-0" },
    vollaard17:  { a: "Vollaard et al., 2017", t: "Effect of number of sprints in a SIT session on change in VO2max: a meta-analysis", j: "Med Sci Sports Exerc 49(6):1147–1156", u: "https://doi.org/10.1249/MSS.0000000000001204" },
    metcalfe12:  { a: "Metcalfe et al., 2012", t: "Towards the minimal amount of exercise for improving metabolic health: beneficial effects of reduced-exertion high-intensity interval training", j: "Eur J Appl Physiol 112", u: "https://doi.org/10.1007/s00421-011-2254-z" },
    helgerud07:  { a: "Helgerud et al., 2007", t: "Aerobic high-intensity intervals improve VO2max more than moderate training", j: "Med Sci Sports Exerc 39(4)", u: "https://pubmed.ncbi.nlm.nih.gov/17414804/" },
    mandsager18: { a: "Mandsager et al., 2018", t: "Association of cardiorespiratory fitness with long-term mortality among adults undergoing exercise treadmill testing", j: "JAMA Network Open 1(6):e183605", u: "https://doi.org/10.1001/jamanetworkopen.2018.3605" },
    ding25:      { a: "Ding et al., 2025", t: "Daily steps and health outcomes in adults: a systematic review and dose-response meta-analysis", j: "Lancet Public Health", u: "https://pubmed.ncbi.nlm.nih.gov/40713949/" },
    stamatakis22:{ a: "Stamatakis et al., 2022", t: "Association of wearable device-measured vigorous intermittent lifestyle physical activity with mortality", j: "Nature Medicine 28", u: "https://doi.org/10.1038/s41591-022-02100-x" },
    islam22:     { a: "Islam et al., 2022", t: "Exercise snacks: a novel strategy to improve cardiometabolic health", j: "Exercise and Sport Sciences Reviews 50(1)", u: "https://pubmed.ncbi.nlm.nih.gov/34669625/" },
    lally10:     { a: "Lally et al., 2010", t: "How are habits formed: modelling habit formation in the real world", j: "European Journal of Social Psychology 40(6)", u: "https://doi.org/10.1002/ejsp.674" },
    gollwitzer06:{ a: "Gollwitzer & Sheeran, 2006", t: "Implementation intentions and goal achievement: a meta-analysis of effects and processes", j: "Advances in Experimental Social Psychology 38", u: "https://doi.org/10.1016/S0065-2601(06)38002-1" },
    pocovi24:    { a: "Pocovi et al., 2024", t: "Effectiveness and cost-effectiveness of an individualised, progressive walking and education intervention for the prevention of low back pain recurrence (WalkBack)", j: "Lancet 404(10448):134–144", u: "https://doi.org/10.1016/S0140-6736(24)00755-4" },
    nelsonwong10:{ a: "Nelson-Wong & Callaghan, 2010", t: "Changes in muscle activation patterns and subjective low back pain ratings during prolonged standing in response to an exercise intervention", j: "J Electromyogr Kinesiol 20(6)", u: "https://doi.org/10.1016/j.jelekin.2010.07.007" },
    laird14:     { a: "Laird et al., 2014", t: "Comparing lumbo-pelvic kinematics in people with and without back pain: a systematic review and meta-analysis", j: "BMC Musculoskeletal Disorders 15:229", u: "https://doi.org/10.1186/1471-2474-15-229" },
    owen20:      { a: "Owen et al., 2020", t: "Which specific modes of exercise training are most effective for treating low back pain? Network meta-analysis", j: "Br J Sports Med 54(21)", u: "https://pubmed.ncbi.nlm.nih.gov/31666220/" },
    powers14:    { a: "Powers et al., 2014", t: "Patellofemoral joint stress during weight-bearing and non-weight-bearing quadriceps exercises", j: "J Orthop Sports Phys Ther 44(5):320–327", u: "https://doi.org/10.2519/jospt.2014.4936" },
    collins18:   { a: "Collins et al., 2018", t: "2018 Consensus statement on exercise therapy and physical interventions (orthoses, taping and manual therapy) to treat patellofemoral pain", j: "Br J Sports Med 52(18):1170", u: "https://bjsm.bmj.com/content/52/18/1170" },
    bricca19:    { a: "Bricca et al., 2019", t: "Impact of exercise on articular cartilage in people at risk of, or with established, knee osteoarthritis: a systematic review of randomised controlled trials", j: "Br J Sports Med 53(15):940", u: "https://bjsm.bmj.com/content/53/15/940" },
    silbernagel07:{ a: "Silbernagel et al., 2007", t: "Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy", j: "Am J Sports Med 35(6)", u: "https://doi.org/10.1177/0363546506298279" },
    svernlov09:  { a: "Svernlöv et al., 2009", t: "Conservative treatment of the cubital tunnel syndrome", j: "J Hand Surg Eur 34(2)", u: "https://pubmed.ncbi.nlm.nih.gov/19282413/" },
    padberg04:   { a: "Padberg et al., 2004", t: "Structured exercise improves calf muscle pump function in chronic venous insufficiency: a randomized trial", j: "J Vasc Surg 39(1)", u: "https://pubmed.ncbi.nlm.nih.gov/14718821/" },
    morton18:    { a: "Morton et al., 2018", t: "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults", j: "Br J Sports Med 52(6)", u: "https://pubmed.ncbi.nlm.nih.gov/28698222/" },
    garthe11:    { a: "Garthe et al., 2011", t: "Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes", j: "Int J Sport Nutr Exerc Metab 21(2)", u: "https://doi.org/10.1123/ijsnem.21.2.97" },
    kreider17:   { a: "Kreider et al., 2017", t: "International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine", j: "J Int Soc Sports Nutr 14:18", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/" },
    brito14:     { a: "Brito et al., 2014", t: "Ability to sit and rise from the floor as a predictor of all-cause mortality", j: "Eur J Prev Cardiol 21(7)", u: "https://escardio.org/The-ESC/Press-Office/Press-releases/Ability-to-sit-and-rise-from-the-floor-is-closely-correlated-with-all-cause-mort" }
  },

  /* m.p — основные мышцы (1 подход), m.s — вспомогательные (0,5 подхода). side — на каждую сторону. unit: reps | sec */
  exercises: {
    backwalk:  { n: "Ходьба спиной вперёд в горку", kind: "warm", cues: ["Дорожка, уклон 5–10 %, 2–3 км/ч, держись за поручни", "Квадрицепс работает, а надколеннику легко — хорошая разминка для колена"] },
    bike_easy: { n: "Лёгкий велосипед или гребля", kind: "warm", cues: ["Пульс чуть выше обычного, можно спокойно говорить"] },

    legpress:  { n: "Жим ногами", m: { p: ["quads"], s: ["glutes", "adductors"] }, cues: ["Стопы на середине платформы, на ширине плеч", "Вниз 3 с — до глубины, где таз ещё прижат к спинке", "Глубина — по светофору колена; внизу без «отбива»"], alts: ["beltsquat", "hack"], tags: ["колено"] },
    hack:      { n: "Гакк-присед (тренажёр)", m: { p: ["quads"], s: ["glutes", "adductors"] }, cues: ["Нагрузка идёт через плечи на позвоночник: тупая боль в пояснице наутро — возвращайся к жиму ногами", "Стопы дальше вперёд — колену легче; глубина по светофору"], alts: ["legpress", "beltsquat"], tags: ["колено", "поясница"] },
    beltsquat: { n: "Присед с поясом (тренажёр)", m: { p: ["quads", "glutes"], s: ["adductors"] }, cues: ["Вес висит на тазу — позвоночник не нагружен", "Корпус вертикально, глубина по светофору колена"], alts: ["legpress", "hack"] },
    bss:       { n: "Болгарский сплит-присед", m: { p: ["quads", "glutes"], s: ["adductors"] }, side: true, cues: ["Гантели в опущенных руках, локоть прямой", "Задняя нога на скамье заодно растягивает сгибатель бедра", "Корпус чуть вперёд — больше ягодиц; глубина — по светофору колена"], alts: ["legpress", "stepup"], tags: ["колено"] },
    stepup:    { n: "Подъёмы на платформу", m: { p: ["quads", "glutes"], s: [] }, side: true, cues: ["Платформа 25–35 см, работает только передняя нога", "Опускайся медленно, 2–3 с"], alts: ["bss"] },
    legext:    { n: "Разгибания ног — нижняя половина", m: { p: ["quads"], s: [] }, cues: ["Амплитуда от полного сгиба до ~45°, не до прямой ноги", "Вниз 2–3 с, без рывка"], why: "В этой зоне нагрузка на надколенник ниже {powers14}, а квадрицепс растёт не хуже, чем при полной амплитуде {pedrosa22}.", alts: ["stepup"], tags: ["колено"] },

    rdl:       { n: "Румынская тяга", m: { p: ["hams", "glutes"], s: ["back"] }, cues: ["Таз назад, колени мягкие, гриф скользит по бёдрам", "Вниз до сильного натяжения сзади бедра, спина нейтральна", "Наверху работают ягодицы: рёбра вниз, без прогиба назад"], alts: ["sl_rdl", "deadlift"], tags: ["поясница"] },
    deadlift:  { n: "Становая тяга (лучше с трэп-грифом)", m: { p: ["glutes", "hams", "back"], s: ["quads", "forearms"] }, cues: ["Трэп-гриф, если есть, мягче для поясницы", "Движение заканчивают ягодицы, рёбра вниз", "Минимум 2 повтора в запасе — это не проверка максимума"], alts: ["rdl"], tags: ["поясница"] },
    hipthrust: { n: "Ягодичный мост со штангой", m: { p: ["glutes"], s: ["hams"] }, cues: ["Подбородок к груди, рёбра вниз", "Наверху подкрути таз — без прогиба в пояснице, пауза 1 с"], alts: ["rdl"] },
    seated_curl:{ n: "Сгибания ног сидя", m: { p: ["hams"], s: [] }, cues: ["Корпус чуть вперёд — растяжение больше", "Вниз 2–3 с"], why: "Сидя задняя поверхность бедра растянута сильнее, чем лёжа, и растёт заметно больше {maeo21}." },
    sl_rdl:    { n: "Румынская тяга на одной ноге", m: { p: ["hams", "glutes"], s: ["core"] }, side: true, cues: ["Гантель в руке со стороны свободной ноги", "Таз ровно, не разворачивай", "Баланс — та самая «функциональность»"], alts: ["rdl"] },
    hip_abd:   { n: "Отведение бедра в тренажёре", m: { p: ["glutes"], s: [] }, cues: ["Корпус чуть вперёд — сильнее средняя ягодичная", "Пауза 1 с в крайней точке"], why: "Средняя ягодичная держит колено и таз при ходьбе и стоянии. Укрепление бедра — основа работы с болью под надколенником {collins18}; упражнения на таз и кор снижали боль от долгого стояния {nelsonwong10}." },

    bench:     { n: "Жим лёжа", m: { p: ["chest"], s: ["triceps", "frontdelts"] }, cues: ["Лопатки сведены и опущены, ступни в упоре", "Прогиб — в грудном отделе, таз на скамье, поясницей не «мостить»", "Тяжёлый жим — 2 повтора в запасе; лёгкий — техника и скорость"], alts: ["machine_press", "incline_db"] },
    incline_db:{ n: "Жим гантелей на наклонной 30°", m: { p: ["chest"], s: ["frontdelts", "triceps"] }, cues: ["Внизу глубокое растяжение груди — это и мобильность плеч", "Локти ~45° к корпусу"], alts: ["machine_press"] },
    machine_press:{ n: "Жим в тренажёре", m: { p: ["chest"], s: ["triceps", "frontdelts"] }, cues: ["Ручки на уровне середины груди", "Вниз 2 с, внизу растяжение"], alts: ["incline_db"] },
    landmine:  { n: "Жим лендмайн с колена", m: { p: ["frontdelts"], s: ["chest", "triceps", "core", "sidedelts"] }, side: true, cues: ["Стоишь на одном колене, ягодица опорной ноги сжата, рёбра вниз", "Толкай вверх-вперёд, лопатка уходит вверх", "Нет станка — угол штанги в угол стены через полотенце"], alts: ["seated_db_press"] },
    seated_db_press:{ n: "Жим гантелей сидя (спинка ~75°)", m: { p: ["frontdelts", "sidedelts"], s: ["triceps"] }, cues: ["Спинка не вертикально — так проще не прогибаться", "Покалывает пальцы внизу — сократи амплитуду"], alts: ["landmine"], tags: ["локоть"] },
    dips:      { n: "Брусья до параллели", m: { p: ["chest", "triceps"], s: ["frontdelts"] }, cues: ["Не глубже, чем плечо на уровне локтя", "Нижняя точка нагружает локоть и малую грудную — их бережём"], alts: ["machine_press", "pushdown"], tags: ["локоть"] },
    pushups_def:{ n: "Отжимания с дефицитом", m: { p: ["chest"], s: ["triceps", "core"] }, unit: "reps", cues: ["Руки на гантелях или блинах, грудь ниже уровня ладоней", "Тело — доска, рёбра вниз"], alts: ["machine_press"] },

    pullup_w:  { n: "Подтягивания с весом", m: { p: ["back"], s: ["biceps", "reardelts"] }, cues: ["Из полного виса: сначала плечи вниз, потом грудь к перекладине", "Наверху не задерживайся — локтям легче", "Немеют пальцы в висе — замени на тягу блока нейтральным хватом"], alts: ["pulldown"], tags: ["локоть"] },
    pullup:    { n: "Подтягивания (свой вес)", m: { p: ["back"], s: ["biceps", "reardelts"] }, unit: "reps", cues: ["Стоп за 2 повтора до отказа", "Слишком легко — повесь 5–10 кг"], alts: ["pullup_w", "pulldown"], tags: ["локоть"] },
    pulldown:  { n: "Тяга верхнего блока (нейтральный хват)", m: { p: ["back"], s: ["biceps", "reardelts"] }, cues: ["Наверху полностью вытянись — широчайшие в растяжении", "Локти вниз, к карманам"], alts: ["pullup_w"] },
    cs_row:    { n: "Тяга с упором грудью", m: { p: ["back"], s: ["reardelts", "biceps"] }, cues: ["Т-гриф с упором или тренажёр — поясница отдыхает", "Внизу дай лопаткам разъехаться — полная амплитуда"], alts: ["cable_row", "sa_db_row"] },
    cable_row: { n: "Тяга нижнего блока сидя", m: { p: ["back"], s: ["reardelts", "biceps"] }, cues: ["Вперёд — растяжение спины, позвоночник нейтрален", "Тяни к низу живота"], alts: ["cs_row"] },
    sa_db_row: { n: "Тяга гантели одной рукой", m: { p: ["back"], s: ["reardelts", "biceps"] }, side: true, cues: ["Опора на скамью ладонью, не локтем", "Тяни к тазу, внизу — растяжение"], alts: ["cs_row"] },
    rev_pecdeck:{ n: "Обратные разведения в тренажёре", m: { p: ["reardelts"], s: [] }, cues: ["Руки почти прямые, движение от плеча", "Последний подход — до отказа"], alts: ["y_raise", "face_pull"] },
    face_pull: { n: "Тяга каната к лицу", m: { p: ["reardelts"], s: ["back"] }, cues: ["Локти высоко и согнуты — поза, которая нравится не всем локтям", "Неприятно в локтях или пальцах — обратные разведения"], alts: ["rev_pecdeck"], tags: ["локоть"] },
    y_raise:   { n: "Y-подъёмы на наклонной", m: { p: ["reardelts"], s: ["sidedelts"] }, cues: ["Грудью на скамье 30–45°, прямые руки буквой Y, большие пальцы вверх", "Гантели 1–4 кг — это про контроль лопаток"], alts: ["rev_pecdeck"] },

    lat_raise_machine:{ n: "Махи в стороны в тренажёре", m: { p: ["sidedelts"], s: [] }, cues: ["Ось тренажёра — на уровне плеча", "Вниз 2 с, последний подход до отказа"], alts: ["lat_raise_db", "lat_raise_cable"] },
    lat_raise_db:     { n: "Махи гантелями в стороны", m: { p: ["sidedelts"], s: [] }, cues: ["Сидя на краю скамьи — меньше раскачки", "До уровня плеча, мизинец не выше большого пальца", "После отказа — 5 частичных повторов внизу"], alts: ["lat_raise_machine", "lat_raise_cable"] },
    lat_raise_cable:  { n: "Махи в сторону на нижнем блоке", m: { p: ["sidedelts"], s: [] }, side: true, cues: ["Трос за спиной — нагрузка там, где мышца растянута", "До уровня плеча, без раскачки"], alts: ["lat_raise_machine", "lat_raise_db"] },

    incline_curl:  { n: "Сгибания на наклонной скамье", m: { p: ["biceps"], s: [] }, cues: ["Скамья 45–60°, руки висят за корпусом — бицепс растянут", "Внизу полное разгибание, локти не уводи вперёд"], alts: ["bayesian_curl", "ez_curl"] },
    bayesian_curl: { n: "Сгибания на блоке спиной к блоку", m: { p: ["biceps"], s: [] }, side: true, cues: ["Рука за корпусом — нагрузка в растянутой позиции", "Шаг вперёд от блока, корпус ровно"], alts: ["incline_curl"] },
    hammer_curl:   { n: "Молотковые сгибания", m: { p: ["biceps"], s: ["forearms"] }, cues: ["Ладони смотрят друг на друга", "Брахиалис «раздвигает» руку — визуально она толще"], alts: ["ez_curl"] },
    ez_curl:       { n: "Сгибания с EZ-грифом", m: { p: ["biceps"], s: ["forearms"] }, cues: ["Без раскачки, вниз 2 с"], alts: ["hammer_curl", "incline_curl"] },

    oh_ext_partial:{ n: "Разгибания из-за головы (локоть до 90°)", m: { p: ["triceps"], s: [] }, cues: ["Канат на блоке, спиной к блоку, локти вперёд-вверх; рёбра вниз, без прогиба в пояснице", "Сгибай локоть только до прямого угла", "Неприятные ощущения в локте или пальцах — в подходе или до следующего утра — замена"], why: "С поднятым плечом длинная головка трицепса растянута — главная причина, почему разгибания из-за головы дали заметно больший рост, чем разгибания вниз {maeo23}. Локоть до 90° — щадящий для локтя вариант.", alts: ["pushdown_lean", "oh_ext_cable"], tags: ["локоть"] },
    oh_ext_cable:  { n: "Разгибания из-за головы — полная амплитуда", m: { p: ["triceps"], s: [] }, cues: ["Сначала 4 недели на варианте до 90° без неприятных ощущений", "Что-то беспокоит в подходе или до следующего утра — назад к варианту до 90°"], alts: ["oh_ext_partial", "pushdown_lean"], tags: ["локоть"] },
    pushdown:      { n: "Разгибания на блоке вниз (канат)", m: { p: ["triceps"], s: [] }, cues: ["Локти у корпуса, внизу разведи канат"], alts: ["pushdown_lean"] },
    pushdown_lean: { n: "Разгибания на блоке с наклоном вперёд", m: { p: ["triceps"], s: [] }, cues: ["Наклонись, плечи вперёд под ~45° — длинная головка растянута сильнее", "Глубокого сгиба локтя нет — локтю спокойно"], alts: ["pushdown"] },

    calf_legpress: { n: "Подъёмы на носки в жиме ногами", m: { p: ["calves"], s: [] }, cues: ["Колени прямые, но не в замке; носки на краю платформы", "Внизу пауза 2 с в растяжении, вверх до конца", "После отказа — 5–10 частичных повторов в нижней половине"], why: "С прямым коленом икроножная выросла на 9–12 %, а при подъёмах сидя почти не росла {kinoshita23}. Частичные повторы в растянутой позиции дали больше роста, чем полная амплитуда {kassiano23} — там тренировали только нижнюю половину, мы совмещаем полную амплитуду и частичные после отказа. Жим ногами не грузит позвоночник.", alts: ["calf_stand", "calf_sl"] },
    calf_stand:    { n: "Подъёмы на носки стоя (тренажёр)", m: { p: ["calves"], s: [] }, cues: ["Упоры на плечах грузят позвоночник: поясница отзывается наутро — возвращайся к жиму ногами", "Пауза 2 с внизу, после отказа — частичные внизу"], alts: ["calf_legpress", "calf_sl"], tags: ["поясница"] },
    calf_seated:   { n: "Подъёмы на носки сидя", m: { p: ["calves"], s: [] }, cues: ["Добавка для камбаловидной; основа массы икр — варианты с прямым коленом", "Пауза 2 с внизу"], alts: ["calf_legpress"] },
    calf_sl:       { n: "Подъёмы на носки на одной ноге", m: { p: ["calves"], s: [] }, side: true, cues: ["На ступеньке или блине, гантель в руке со стороны ноги", "Колено прямое, внизу пауза 2 с"], alts: ["calf_legpress"] },

    deadbug:       { n: "Жук (dead bug)", m: { p: ["core"], s: [] }, unit: "reps", side: true, cues: ["Поясница прижата к полу всё время", "Выдох — медленно разгибай противоположные руку и ногу", "Оторвалась поясница — уменьши амплитуду"], alts: ["ab_wheel"] },
    ab_wheel:      { n: "Ролик с колен", m: { p: ["core"], s: [] }, unit: "reps", cues: ["Таз подкручен, ягодицы сжаты", "Катись только до точки, где поясница ещё не прогибается"], alts: ["deadbug", "rkc_plank"] },
    rkc_plank:     { n: "Планка RKC", m: { p: ["core"], s: [] }, unit: "sec", cues: ["10 с максимального напряжения: локти тянут к носкам, ягодицы и пресс сжаты", "Вместо минуты вялой планки"], alts: ["ab_wheel"] },
    pallof:        { n: "Паллоф-пресс", m: { p: ["core"], s: [] }, side: true, cues: ["Боком к блоку, выпрями руки от груди — корпус не поворачивается", "Пауза 2 с с вытянутыми руками"], alts: ["side_plank"] },
    side_plank:    { n: "Боковая планка", m: { p: ["core"], s: [] }, unit: "sec", side: true, cues: ["Тело в линию, таз не провисает"], alts: ["suitcase_hold"] },
    suitcase_hold: { n: "Удержание «чемодана»", m: { p: ["core"], s: ["forearms"] }, unit: "sec", side: true, cues: ["Тяжёлая гантель в одной руке, стой ровно, не заваливаясь", "Есть место — иди"], alts: ["side_plank"] },
    farmer_hold:   { n: "Фермерское удержание", m: { p: ["forearms"], s: ["core"] }, unit: "sec", cues: ["Две тяжёлые гантели, плечи и рёбра вниз", "Есть место — фермерская прогулка"], alts: ["suitcase_hold"] },
    reverse_crunch:{ n: "Обратные скручивания на скамье", m: { p: ["core"], s: [] }, unit: "reps", cues: ["Подкручивай таз к рёбрам — учит контролировать положение таза", "Без рывка, вниз медленно"], alts: ["deadbug"] },
    mb_chest:      { n: "Бросок медбола от груди в стену", m: { p: [], s: [] }, unit: "reps", cues: ["Максимально взрывно, между бросками 10–15 с", "Мощность с возрастом уходит быстрее силы — это её поддержка", "Нет места — отжимания с дефицитом"], alts: ["pushups_def"] }
  },

  blocks: [
    {
      id: 1, name: "Перезагрузка", weeks: "1–5",
      theme: "Новые упражнения, нагрузка в растянутой позиции, умеренные веса и контроль. Базовые 8–12 повторов (тяжёлый жим 6–8), изоляция 12–20.",
      skill: {
        title: "Глубокий присед",
        goal: "2 минуты в нижней точке без опоры, пятки на полу",
        weeks: ["4 × 30 с, держась за стойку", "3 × 45 с с лёгкой опорой", "2 × 60 с с противовесом (блин 5 кг на прямых руках)", "2 × 60 с без опоры", "2 минуты подряд"],
        cues: ["Пятки на полу, колени по линии носков; можно покачиваться", "Пятки отрываются — подложи блин 1–2 см и добавь «колено к стене» 2 × 10 на ногу", "Глубина — по светофору колена: хруст без боли не стоп-сигнал"]
      },
      targets: ["Глубокий присед: 2 минуты без опоры", "Икры в жиме ногами: +3 повтора на весе недели 1 (или +10 % веса)", "Сгибания на наклонной: +2 повтора или следующая гантель", "Талия: −1,5–2 см"]
    },
    {
      id: 2, name: "Сила", weeks: "6–10",
      theme: "Тяжелее на якорях — жим, подтягивания, становая: 4–8 повторов, отдых 2,5–3 мин. Остальное 8–12.",
      skill: {
        title: "Встать с пола без рук",
        goal: "Сесть на пол, скрестив ноги, и встать без опоры на руки и колени",
        weeks: ["5 раз с опорой на одну руку", "5 раз с опорой на колено", "5 раз без рук, колено можно", "3–5 раз без рук и колен", "3 чистых раза подряд"],
        cues: ["Скрести голени, корпус вперёд, толкайся стопами", "Это проба «сесть-встать»: низкий балл связан с более высокой смертностью у людей 51–80 лет {brito14}"]
      },
      targets: ["Подтягивания: +2,5 кг к рабочему весу на те же повторы", "Тяжёлый жим недели 8: +2,5 кг к неделе 6", "Становая недели 8: +5 кг к неделе 6 на те же повторы, спина ровная", "Встать с пола без рук и колен"]
    },
    {
      id: 3, name: "Плотность", weeks: "11–15",
      theme: "Больше работы за то же время: суперсеты, майо-повторы, броски медбола. 10–20 повторов, отдых короче.",
      skill: {
        title: "Руки над головой",
        goal: "Спиной к стене, поясница прижата — прямые руки касаются стены над головой; вис до 60 с без неприятных ощущений",
        weeks: ["Скольжения прямыми руками по стене 2 × 8", "Скольжения 2 × 8 + вис 2 × 20–30 с", "Скольжения 2 × 8 + вис 2 × 30–45 с", "Вис до 60 с", "Прямые руки на стене + вис до 60 с"],
        cues: ["Руки прямые: с согнутыми локтями над головой плечам и локтям тяжелее", "Рёбра вниз, поясница не отлипает от стены", "Покалывание в пальцах — стоп, в следующий раз амплитуда или время меньше"]
      },
      targets: ["Прямые руки на стене над головой с прижатой поясницей", "Вис 60 с — или сколько получается комфортно, и запиши время", "Подтягивания с собственным весом: +2 повтора в подходе при RIR 2 (неделя 14 против 11)", "Обхват руки и икры не меньше стартового при талии на 3+ см меньше"]
    }
  ],

  /* Тиры: core — всегда (60 мин), std — с 90 мин, max — 120 мин.
     kind: warmup | pair | tri | circuit | sprint | z2 | n4x4 | skill
     hl — тяжёлый/лёгкий жим (недели 1, 3 — тяжёлый); weekAlt — чередование по неделям; myo — майо-повторы (eff — подходы «по стимулу»); ramp — у первого упражнения есть разминочные подходы */
  sessions: {
    "1A": {
      title: "Низ + жим + трицепс", day: "Пн",
      groups: [
        { id: "W", kind: "warmup", tier: "core", min: 7, items: [{ ex: "backwalk", dose: "4 мин" }, { skill: true, dose: "2 мин" }, { text: "Разминочные подходы жима ногами: лёгкий × 10, средний × 5" }] },
        { id: "A", kind: "pair", tier: "core", rest: "90 с", items: [
          { ex: "legpress", sets: 3, reps: "10–12", rir: "2", tempo: "3 с вниз" },
          { ex: "deadbug", sets: 3, reps: "6", rir: null }] },
        { id: "B", kind: "pair", tier: "core", rest: "2 мин", ramp: true, items: [
          { ex: "bench", hl: { heavy: { sets: 3, reps: "6–8", rir: "2", note: "Разминка: 50 % × 8 → 70 % × 4 → 85 % × 2" }, light: { sets: 3, reps: "10–12", rir: "3–4", note: "Пауза 1 с на груди, вверх быстро. Разминка: 50 % × 8 → 70 % × 3" } } },
          { ex: "calf_legpress", sets: 4, reps: "10–15", rir: "0–1", note: "Последний подход: после отказа 5–10 частичных внизу" }] },
        { id: "C", kind: "tri", tier: "core", rest: "45–60 с", items: [
          { ex: "oh_ext_partial", sets: 3, reps: "10–15", rir: "0–1" },
          { ex: "hammer_curl", sets: 3, reps: "10–12", rir: "1–2" },
          { ex: "lat_raise_machine", sets: 3, reps: "12–20", rir: "0–1" }] },
        { id: "D", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "legext", sets: 3, reps: "12–15", rir: "1" },
          { ex: "pushdown", sets: 3, reps: "12–15", rir: "0–1" }] },
        { id: "E", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "incline_db", sets: 3, reps: "8–12", rir: "2" },
          { ex: "calf_seated", sets: 3, reps: "15–20", rir: "0–1" }] },
        { id: "G", kind: "pair", tier: "max", rest: "45–60 с", items: [
          { ex: "rev_pecdeck", sets: 2, reps: "15–20", rir: "1" },
          { ex: "reverse_crunch", sets: 2, reps: "10–15", rir: "1–2" }] },
        { id: "S", kind: "sprint", tier: "std" },
        { id: "Z", kind: "z2", tier: "max" }
      ]
    },
    "1B": {
      title: "Спина + задняя цепь + бицепс", day: "Вт",
      groups: [
        { id: "W", kind: "warmup", tier: "core", min: 7, items: [{ ex: "bike_easy", dose: "3 мин" }, { skill: true, dose: "2 мин" }, { text: "Разминочные подходы: подтягивания без веса × 5, +10 кг × 3" }] },
        { id: "A", kind: "pair", tier: "core", rest: "2 мин", items: [
          { ex: "pullup_w", sets: 3, reps: "6–10", rir: "2", note: "Ориентир +15–25 кг" },
          { ex: "calf_legpress", sets: 4, reps: "15–20", rir: "1–2", note: "Вчера были икры — сегодня легче и с запасом" }] },
        { id: "B", kind: "tri", tier: "core", rest: "2 мин", ramp: true, items: [
          { ex: "rdl", sets: 3, reps: "8–10", rir: "2", note: "Разминка: 50 % × 8 → 70 % × 5" },
          { ex: "pallof", sets: 3, reps: "10", rir: null },
          { ex: "hip_abd", sets: 2, reps: "15–20", rir: "1" }] },
        { id: "C", kind: "tri", tier: "core", rest: "45–60 с", items: [
          { ex: "incline_curl", sets: 3, reps: "10–15", rir: "0–1" },
          { ex: "pushdown_lean", sets: 3, reps: "12–15", rir: "1–2" },
          { ex: "lat_raise_db", sets: 3, reps: "12–20", rir: "1–2" }] },
        { id: "D", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "cs_row", sets: 3, reps: "8–12", rir: "1–2" },
          { ex: "rev_pecdeck", sets: 3, reps: "15–20", rir: "0–1" }] },
        { id: "E", kind: "pair", tier: "std", rest: "60 с", items: [
          { ex: "seated_curl", sets: 3, reps: "10–12", rir: "1" },
          { ex: "bayesian_curl", sets: 2, reps: "12–15", rir: "0–1" }] },
        { id: "G", kind: "pair", tier: "max", rest: "45–60 с", items: [
          { ex: "farmer_hold", sets: 3, reps: "30–40 с", rir: null },
          { ex: "side_plank", sets: 2, reps: "30–40 с", rir: null }] },
        { id: "S", kind: "sprint", tier: "std" },
        { id: "Z", kind: "z2", tier: "max" }
      ]
    },
    "1C": {
      title: "Мотор + памп", day: "Сб",
      note: "Нет зала — интервалы дома на велотренажёре или дорожке, плюс подъёмы на носки на ступеньке 3 × 15–20 и навык. Или прогулка — столько, сколько проходишь без боли в спине.",
      groups: [
        { id: "N", kind: "n4x4", tier: "core" },
        { id: "A", kind: "pair", tier: "core", rest: "90 с", items: [
          { ex: "incline_db", sets: 3, reps: "8–12", rir: "2" },
          { ex: "pulldown", sets: 3, reps: "10–12", rir: "1" }] },
        { id: "B", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "bss", sets: 2, reps: "8–12", rir: "2" },
          { ex: "calf_legpress", sets: 3, reps: "12–15", rir: "0–1" }] },
        { id: "C", kind: "tri", tier: "std", rest: "45–60 с", items: [
          { ex: "ez_curl", sets: 2, reps: "10–15", rir: "0–1" },
          { ex: "oh_ext_partial", sets: 2, reps: "12–15", rir: "0–1" },
          { ex: "lat_raise_machine", sets: 2, reps: "15–20", rir: "0–1" }] },
        { id: "K", kind: "skill", tier: "std" }
      ]
    },

    "2A": {
      title: "Низ + жим + трицепс", day: "Пн",
      groups: [
        { id: "W", kind: "warmup", tier: "core", min: 8, items: [{ ex: "backwalk", dose: "4 мин" }, { skill: true, dose: "2 мин" }, { text: "+1 мин навыка прошлого блока — глубокий присед" }, { text: "Разминочные подходы жима ногами: лёгкий × 10, средний × 5, тяжелее × 2" }] },
        { id: "A", kind: "pair", tier: "core", rest: "2 мин", items: [
          { ex: "legpress", sets: 4, reps: "6–8", rir: "2", note: "Тяжёлый день ног — без нагрузки на позвоночник" },
          { ex: "ab_wheel", sets: 3, reps: "6–10", rir: "1–2" }] },
        { id: "B", kind: "pair", tier: "core", rest: "2 мин", ramp: true, items: [
          { ex: "bench", hl: { heavy: { sets: 4, reps: "4–6", rir: "2", note: "Разминка: 50 % × 8 → 70 % × 4 → 85 % × 2 → 90 % × 1" }, light: { sets: 3, reps: "8", rir: "3", note: "Вверх максимально быстро, вниз под контролем. Разминка: 50 % × 8 → 70 % × 3" } } },
          { ex: "calf_legpress", sets: 4, reps: "6–10", rir: "1", note: "Тяжело, пауза 2 с внизу" }] },
        { id: "C", kind: "tri", tier: "core", rest: "60 с", items: [
          { ex: "oh_ext_partial", sets: 3, reps: "8–12", rir: "1" },
          { ex: "hammer_curl", sets: 3, reps: "8–10", rir: "1–2" },
          { ex: "lat_raise_machine", sets: 3, reps: "10–15", rir: "0–1" }] },
        { id: "D", kind: "pair", tier: "std", rest: "90 с", items: [
          { ex: "legext", sets: 3, reps: "10–12", rir: "1" },
          { ex: "dips", sets: 3, reps: "6–10", rir: "2" }] },
        { id: "E", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "landmine", sets: 3, reps: "6–10", rir: "2" },
          { ex: "calf_seated", sets: 3, reps: "12–15", rir: "0–1" }] },
        { id: "G", kind: "pair", tier: "max", rest: "45–60 с", items: [
          { ex: "rev_pecdeck", sets: 2, reps: "15–20", rir: "1" },
          { ex: "reverse_crunch", sets: 2, reps: "10–15", rir: "1–2" }] },
        { id: "S", kind: "sprint", tier: "std" },
        { id: "Z", kind: "z2", tier: "max" }
      ]
    },
    "2B": {
      title: "Спина + задняя цепь + бицепс", day: "Вт",
      groups: [
        { id: "W", kind: "warmup", tier: "core", min: 8, items: [{ ex: "bike_easy", dose: "3 мин" }, { skill: true, dose: "2 мин" }, { text: "+1 мин глубокого приседа" }, { text: "Разминочные подходы: подтягивания без веса × 5, +15 кг × 3, +25 кг × 1" }] },
        { id: "A", kind: "pair", tier: "core", rest: "2–2,5 мин", items: [
          { ex: "pullup_w", sets: 4, reps: "4–6", rir: "1–2", note: "Ориентир +30–35 кг" },
          { ex: "calf_legpress", sets: 4, reps: "12–15", rir: "1–2", note: "Вчера были тяжёлые икры — сегодня с запасом" }] },
        { id: "B", kind: "tri", tier: "core", rest: "2–2,5 мин", ramp: true, items: [
          { weekAlt: [
            { ex: "deadlift", sets: 3, reps: "4–6", rir: "2", note: "Тяжёлая неделя — становая. Разминка: 50 % × 5 → 70 % × 3 → 85 % × 1–2" },
            { ex: "rdl", sets: 3, reps: "6–8", rir: "2", note: "Остальные недели — румынская. Разминка: 50 % × 8 → 70 % × 5" }] },
          { ex: "pallof", sets: 3, reps: "8", rir: null },
          { ex: "hip_abd", sets: 2, reps: "12–15", rir: "1" }] },
        { id: "C", kind: "tri", tier: "core", rest: "60 с", items: [
          { ex: "ez_curl", sets: 3, reps: "6–10", rir: "1" },
          { ex: "pushdown", sets: 3, reps: "8–12", rir: "1–2" },
          { ex: "lat_raise_db", sets: 3, reps: "10–15", rir: "1–2" }] },
        { id: "D", kind: "pair", tier: "std", rest: "90 с", items: [
          { ex: "cs_row", sets: 3, reps: "6–10", rir: "1–2" },
          { ex: "rev_pecdeck", sets: 3, reps: "12–15", rir: "0–1" }] },
        { id: "E", kind: "pair", tier: "std", rest: "60 с", items: [
          { ex: "seated_curl", sets: 3, reps: "8–10", rir: "1" },
          { ex: "incline_curl", sets: 3, reps: "8–12", rir: "0–1" }] },
        { id: "G", kind: "pair", tier: "max", rest: "45–60 с", items: [
          { ex: "farmer_hold", sets: 3, reps: "30–45 с", rir: null, note: "Тяжело" },
          { ex: "side_plank", sets: 2, reps: "30–45 с", rir: null }] },
        { id: "S", kind: "sprint", tier: "std" },
        { id: "Z", kind: "z2", tier: "max" }
      ]
    },
    "2C": {
      title: "Мотор + памп", day: "Сб",
      note: "Нет зала — интервалы дома на велотренажёре или дорожке, плюс подъёмы на носки на ступеньке 3 × 15–20 и навык. Или прогулка — столько, сколько проходишь без боли в спине.",
      groups: [
        { id: "N", kind: "n4x4", tier: "core" },
        { id: "A", kind: "pair", tier: "core", rest: "90 с", items: [
          { ex: "incline_db", sets: 3, reps: "6–10", rir: "2" },
          { ex: "cable_row", sets: 3, reps: "8–12", rir: "1" }] },
        { id: "B", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "bss", sets: 2, reps: "8–10", rir: "2" },
          { ex: "calf_legpress", sets: 3, reps: "10–15", rir: "0–1" }] },
        { id: "C", kind: "tri", tier: "std", rest: "45–60 с", items: [
          { ex: "bayesian_curl", sets: 2, reps: "10–15", rir: "0–1" },
          { ex: "pushdown_lean", sets: 2, reps: "10–15", rir: "0–1" },
          { ex: "lat_raise_machine", sets: 2, reps: "15–20", rir: "0–1" }] },
        { id: "K", kind: "skill", tier: "std" }
      ]
    },

    "3A": {
      title: "Низ + жим + трицепс", day: "Пн",
      groups: [
        { id: "W", kind: "warmup", tier: "core", min: 8, items: [{ ex: "backwalk", dose: "4 мин" }, { skill: true, dose: "2 мин" }, { text: "+1 мин навыков прошлых блоков: глубокий присед, встать с пола" }, { text: "Разминочные подходы сплит-приседа: без веса × 8 на ногу" }] },
        { id: "A", kind: "pair", tier: "core", rest: "90 с", items: [
          { ex: "bss", sets: 3, reps: "10–12", rir: "2", note: "Глубоко, но по светофору колена — это и мобильность бедра" },
          { ex: "rkc_plank", sets: 3, reps: "10 с", rir: null }] },
        { id: "B", kind: "pair", tier: "core", rest: "90 с", ramp: true, items: [
          { ex: "bench", hl: { heavy: { sets: 3, reps: "6", rir: "2", note: "Разминка: 50 % × 8 → 70 % × 4 → 85 % × 2" }, light: { sets: 2, reps: "12–15", rir: "2", note: "Разминка: 50 % × 8" } } },
          { ex: "calf_legpress", sets: 4, reps: "15–25", rir: "0", note: "До отказа + частичные внизу" }] },
        { id: "C", kind: "tri", tier: "core", rest: "45 с", items: [
          { ex: "oh_ext_partial", sets: 3, reps: "12–15", rir: "0–1" },
          { ex: "hammer_curl", sets: 2, myo: true, eff: 4 },
          { ex: "lat_raise_machine", sets: 2, myo: true, eff: 4 }] },
        { id: "D", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "legext", sets: 1, myo: true, eff: 2 },
          { ex: "pushdown", sets: 3, reps: "15–20", rir: "0–1" }] },
        { id: "E", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "mb_chest", sets: 3, reps: "5", rir: null, note: "Взрывно. Нет места — отжимания с дефицитом" },
          { ex: "calf_seated", sets: 3, reps: "15–20", rir: "0–1" }] },
        { id: "G", kind: "pair", tier: "max", rest: "45–60 с", items: [
          { ex: "landmine", sets: 3, reps: "10–12", rir: "1–2" },
          { ex: "rev_pecdeck", sets: 2, reps: "15–20", rir: "1" }] },
        { id: "S", kind: "sprint", tier: "std" },
        { id: "Z", kind: "z2", tier: "max" }
      ]
    },
    "3B": {
      title: "Спина + задняя цепь + бицепс", day: "Вт",
      groups: [
        { id: "W", kind: "warmup", tier: "core", min: 8, items: [{ ex: "bike_easy", dose: "3 мин" }, { skill: true, dose: "2 мин" }, { text: "+1 мин навыков прошлых блоков" }, { text: "Разминочные подходы: подтягивания × 5, мост лёгкий × 10" }] },
        { id: "A", kind: "pair", tier: "core", rest: "90 с", items: [
          { ex: "pullup", sets: 3, reps: "8–12", rir: "2", note: "Свой вес; легко — +5–10 кг" },
          { ex: "calf_legpress", sets: 4, reps: "15–20", rir: "1–2", note: "Вчера был отказ — сегодня с запасом" }] },
        { id: "B", kind: "tri", tier: "core", rest: "90 с", items: [
          { ex: "hipthrust", sets: 3, reps: "10–12", rir: "1–2" },
          { ex: "suitcase_hold", sets: 3, reps: "30–40 с", rir: null },
          { ex: "hip_abd", sets: 2, reps: "15–20", rir: "1" }] },
        { id: "C", kind: "tri", tier: "core", rest: "45 с", items: [
          { ex: "incline_curl", sets: 2, myo: true, eff: 4 },
          { ex: "pushdown_lean", sets: 2, myo: true, eff: 4 },
          { ex: "lat_raise_db", sets: 3, reps: "12–15", rir: "1–2" }] },
        { id: "D", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "sa_db_row", sets: 3, reps: "10–12", rir: "1" },
          { ex: "rev_pecdeck", sets: 3, reps: "15–20", rir: "0–1" }] },
        { id: "E", kind: "pair", tier: "std", rest: "60–75 с", items: [
          { ex: "sl_rdl", sets: 3, reps: "8–10", rir: "2" },
          { ex: "bayesian_curl", sets: 2, reps: "12–15", rir: "0–1" }] },
        { id: "G", kind: "pair", tier: "max", rest: "45–60 с", items: [
          { ex: "seated_curl", sets: 3, reps: "12–15", rir: "1" },
          { ex: "reverse_crunch", sets: 2, reps: "12–15", rir: "1" }] },
        { id: "S", kind: "sprint", tier: "std" },
        { id: "Z", kind: "z2", tier: "max" }
      ]
    },
    "3C": {
      title: "Мотор + памп", day: "Сб",
      note: "Нет зала — интервалы дома на велотренажёре или дорожке, плюс подъёмы на носки на ступеньке 3 × 15–20 и навык. Или прогулка — столько, сколько проходишь без боли в спине.",
      groups: [
        { id: "N", kind: "n4x4", tier: "core" },
        { id: "A", kind: "circuit", tier: "core", rest: "90 с между кругами", rounds: 3, items: [
          { ex: "incline_db", sets: 3, reps: "10–12", rir: "1–2" },
          { ex: "pulldown", sets: 3, reps: "10–12", rir: "1" },
          { ex: "legpress", sets: 3, reps: "12–15", rir: "2" },
          { ex: "calf_legpress", sets: 3, reps: "15–20", rir: "0–1" }] },
        { id: "B", kind: "pair", tier: "std", rest: "60 с", items: [
          { ex: "ez_curl", sets: 2, reps: "12–15", rir: "0–1" },
          { ex: "pushdown", sets: 2, reps: "12–15", rir: "0–1" }] },
        { id: "K", kind: "skill", tier: "std" }
      ]
    }
  },

  /* Тексты разделов. {key} — ссылка на источник, {{var}} — подставляется из настроек */
  content: {
    how: `
      <ol class="steps">
        <li><b>Неделя.</b> Дни тренировок выбираешь сам («План» → «Дни тренировок»), по умолчанию Пн — A, Вт — B, Сб — C по желанию. Неделя программы закрывается, когда сделаны A и B: пропустил день — следующая тренировка предложится в любой другой, отпуск ставит программу на паузу. Пропущенное не догоняй. Пн и Вт подряд — рабочий вариант: базовые движения не пересекаются (ноги и жим в A, спина и тяги в B). Руки, икры и дельты есть в обоих днях, поэтому во второй день то, что работало в первый, идёт с запасом 1–2 повтора.</li>
        <li><b>Время.</b> 60 минут — ядро: руки, икры, дельты и база нагрузку получают всё равно. 90 — стандарт со спринтами. 120 — плюс кардио в зоне 2. Оценка времени в шапке тренировки учитывает отдых.</li>
        <li><b>Самочувствие «так себе».</b> На подход меньше, +1 повтор в запасе, без спринтов и бонусов, субботние интервалы заменяются зоной 2. Подстраивать нагрузку под самочувствие — рабочий метод, не хуже фиксированного плана {hickmott22}. Пришёл и сделал ядро — тренировка засчитана. На следующий день режим сам вернётся в «норм».</li>
        <li><b>Пары и тройки — суперсеты.</b> А1 → 30–60 с → А2 → отдых → по кругу. Тренировка заметно короче, а рост и сила те же {zhang25}.</li>
        <li><b>RIR</b> — сколько повторов осталось «в запасе». 0 — следующий технично не получится. Для роста важна близость к отказу, для силы она почти не важна {robinson24} — поэтому изоляцию на блоках и тренажёрах доводим до 0–1, а базовые оставляем с 1–3 повторами в запасе.</li>
        <li><b>Прогрессия — двойная.</b> Сделал верх диапазона во всех подходах при нужном RIR — в следующий раз +2,5–5 % веса (или следующая гантель) и снова от низа диапазона. Добавлять повторы так же эффективно, как вес {plotkin22}.</li>
        <li><b>Неделя 5 каждого блока — разгрузочная:</b> веса −10–15 %, подходов на один меньше, RIR 3–4. Сорвалась неделя по форс-мажору — считай её разгрузочной и не догоняй {bell23}.</li>
        <li><b>Замены.</b> У каждого упражнения есть альтернатива — тренажёр занят, локоть или колено не в духе, просто надоело. Вспомогательные можно менять хоть каждую неделю: на рост это не влияет, а интерес поддерживает {bazvalle19}. Якоря — жим, подтягивания, икры — внутри блока лучше не трогать: по ним виден прогресс.</li>
      </ol>`,

    progression: `
      <ul class="dots">
        <li><b>Майо-повторы</b> (блок 3): подход на 12–20 до 0–1 RIR, затем 15 с отдыха и мини-подходы по 3–5 повторов, пока получается (обычно 3–4). Такие техники примерно вдвое сокращают время при том же объёме {iversen21}.</li>
        <li><b>Жим лёжа</b> — раз в неделю: тяжёлый (недели 1 и 3 блока) и лёгкий (недели 2 и 4) чередуются, как ты хотел.</li>
        <li><b>Отдых</b>: базовые 2–3 мин, изоляция 60–90 с. Отдых больше минуты для роста немного лучше {singer24} — поэтому экономим не на отдыхе, а на суперсетах.</li>
        <li><b>Икры</b>: пауза 2 с внизу в каждом повторе, после отказа — частичные повторы в нижней половине. В исследовании частичные в растяжении дали больше роста, чем полная амплитуда {kassiano23}; там тренировали только нижнюю половину, мы совмещаем оба варианта.</li>
        <li><b>Поясница</b>: тупая боль наутро после упражнения — в следующий раз замена. Альтернатива есть у каждого упражнения.</li>
      </ul>`,

    cardio: `
      <section class="card">
        <h3>Перед стартом</h3>
        <p>Если кардио давно не было, перед интервалами разумно один раз измерить давление и сделать ЭКГ покоя, а заодно сдать липиды и глюкозу — после 35–40 лет такая проверка нужна и так.</p>
      </section>
      <section class="card">
        <h3>Шаги — фундамент, но постепенно</h3>
        <p>7000 шагов в день против 2000 связаны с на 47 % меньшей смертностью и на 38 % меньшим риском деменции {ding25}. Если долгая ходьба отзывается в пояснице, шаги растут по правилу:</p>
        <ul class="dots">
          <li>Найди, сколько проходишь без боли, и разбей это на 2–3 прогулки в день.</li>
          <li>Прибавляй не больше 10–20 % в неделю — и только если наутро спина спокойна (тот же светофор, что для колена).</li>
          <li>Постепенная ходьба отодвигала рецидив боли в спине почти вдвое {pocovi24} — но именно постепенная и дозированная.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Спринты для VO₂max — 10 минут после силовой</h3>
        <p>В режимах 90 и 120 минут. Велотренажёр с высоким сопротивлением или эйр-байк: 3 мин легко → 20 с всё, что есть → 3 мин легко → 20 с → 2–3 мин заминки.</p>
        <ul class="dots">
          <li>Двух спринтов достаточно: больше повторов прироста VO₂max не добавляют {vollaard17}. В исследованиях с тремя сессиями в неделю VO₂max рос на 8–15 % за 6–8 недель {vollaard17}{metcalfe12}; у тебя сессий 2–3, так что эффект будет скромнее — направление то же.</li>
          <li>Блок 1, недели 1–2 — адаптация: 2 × 15 с примерно на 80 %.</li>
          <li>Почему не бег: велосипед бережёт колено и ахилл, а кардио после силовой рост мышц не тормозит {schumann22}.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Интервалы 4×4 — суббота или дом</h3>
        <p>По умолчанию — велотренажёр или гребля: без ударной нагрузки на колено и без долгой ходьбы для поясницы. 8–10 мин разминки (это и есть разминка дня) → 4 × 4 мин «тяжело, но ровно» ({{hr85}}–{{hr95}} уд/мин; можешь сказать 3–4 слова) с 3 мин лёгкого хода → 5 мин заминки. Интервалы 4×4 трижды в неделю подняли VO₂max на 7 % за 8 недель, а равная по работе умеренная нагрузка — нет {helgerud07}.</p>
        <ul class="dots">
          <li>Блок 1: недели 1–2 — 3 × 3 мин умеренно-тяжело (говоришь короткими фразами), недели 3–4 — 3 × 3 мин тяжело; отдых 2 мин.</li>
          <li>Блоки 2–3 — 4 × 4 мин с отдыхом 3 мин (в блоке 3 для разнообразия можно 5 × 3). Разгрузочная неделя — 2 × 4.</li>
          <li>Дорожка с уклоном 8–12 % и быстрой ходьбой — вариант, если поясница спокойна.</li>
          <li>Кардиореспираторная форма — один из сильнейших предикторов продолжительности жизни, и «потолка пользы» в данных не видно {mandsager18}.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Зона 2</h3>
        <p>В режиме 120 минут — 15–20 мин, дома — 20–40 мин. Велотренажёр или гребля; ходьба в горку (уклон 6–10 %, 5–6 км/ч) — если спина спокойна: многим с «разгибательной» поясницей подъём комфортнее ровной дороги. Темп разговорный — можешь говорить полными фразами, {{hr60}}–{{hr70}} уд/мин.</p>
        <p class="muted">Пульс: максимальный оценочно {{hrmax}} уд/мин (формула 208 − 0,7 × возраст, ошибка ±10). Купишь часы — поправь значение в «Журнале → Настройки».</p>
      </section>
      <section class="card">
        <h3>Микродозы — по желанию, засчитывается даже одна в день</h3>
        <p>Короткие интенсивные эпизоды в быту связаны с заметно меньшей смертностью: около трёх эпизодов по 1–2 минуты в день — на 38–40 % ниже риск (наблюдательные данные, в основном люди за 60) {stamatakis22}; такие «перекусы» улучшают и кардиореспираторную форму {islam22}. Чтобы не думать, привязывай к тому, что и так делаешь: конкретный план «если → то» заметно повышает шанс это сделать {gollwitzer06}, а пропуск дня привычку не ломает {lally10}.</p>
        <ul class="habits">
          <li><span>Чищу зубы</span><span>→ подъёмы на носки на одной ноге, по 30 с на ногу (икры и венозный насос)</span></li>
          <li><span>Жду чайник или кофе</span><span>→ глубокий присед 30–60 с, держась за столешницу</span></li>
          <li><span>Созвон без камеры</span><span>→ на дорожку (когда появится), в темпе, комфортном для спины</span></li>
          <li><span>Возвращаюсь домой налегке</span><span>→ по лестнице пешком: это и есть те 1–1,5 минуты интенсивной нагрузки</span></li>
          <li><span>Утренний кофе</span><span>→ сразу креатин</span></li>
        </ul>
      </section>
      <section class="card warn">
        <h3>Безопасность</h3>
        <p>Первые две недели спринтов и интервалов — не на максимум. Никотин — не ближе чем за 1–2 часа до них. Давящая боль в груди, необычная одышка, головокружение, перебои — остановиться и проверить сердце.</p>
      </section>`,

    body: `
      <section class="card">
        <h3>Светофор нагрузки</h3>
        <ul class="dots">
          <li>Боль или дискомфорт до 3/10 во время упражнения, и наутро не хуже, чем было, — продолжаем. 4–5/10 или наутро хуже — меньше амплитуда или вес. Больше 5/10 — заменить упражнение {silbernagel07}.</li>
          <li>Ориентир — не звук в суставе, а боль и отёк. Дозированная нагрузка хрящу, по данным рандомизированных исследований, не вредит (уверенность доказательств невысокая) {bricca19}.</li>
          <li>У каждого упражнения есть замена — выбирай её во вкладке «Сегодня», если сустав «не в духе».</li>
        </ul>
      </section>
      <section class="card">
        <h3>Колени</h3>
        <ul class="dots">
          <li>Нагрузка на надколенник зависит от угла: в жимах и приседах легче верхняя часть амплитуды, в разгибаниях ног — нижняя половина, от 90° до 45° {powers14}. Поэтому разгибания в программе — в нижней половине: и колену легче, и квадрицепс растёт не хуже {pedrosa22}.</li>
          <li>При боли под надколенником основа — укрепление бедра и таза {collins18}. Разминка — ходьба спиной вперёд в горку: квадрицепс работает, а надколеннику легко.</li>
          <li>Приседа со штангой на спине нет: квадрицепс получаем из жима ногами, разгибаний и сплит-приседа.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Поясница</h3>
        <ul class="dots">
          <li>Осанка с болью связана слабо {laird14}: мы не «чиним осанку», а повышаем выносливость кора и ягодиц. Боль от долгого стояния уменьшалась от упражнений на кор и таз {nelsonwong10}; при болях в спине помогают структурированные упражнения {owen20}.</li>
          <li><b>Правило:</b> тупая боль в пояснице наутро после упражнения — в следующий раз замена. Поэтому икры по умолчанию в жиме ногами, а не в тренажёре с упорами на плечи.</li>
          <li>Ходьба с постепенным ростом объёма отодвигала рецидив боли в спине {pocovi24} — шаги растут по правилу из вкладки «Кардио».</li>
        </ul>
      </section>
      <section class="card">
        <h3>Икры и сидячая работа</h3>
        <ul class="dots">
          <li>Икроножная работает как насос для вен ног; регулярная тренировка икр улучшала его работу {padberg04}.</li>
          <li>Долго сидишь — раз в 30–60 минут 15–20 подъёмов на носки.</li>
        </ul>
      </section>
      <section class="card danger">
        <h3>Красные флаги — это уже к врачу</h3>
        <ul class="dots">
          <li>Колено: отёк, «заклинивание», боль сильнее 5/10, которая держится наутро.</li>
          <li>Спина: боль отдаёт в ногу ниже колена, онемение или слабость в ноге. Срочно — онемение в промежности, проблемы с мочеиспусканием или стулом.</li>
          <li>Рука: слабость кисти, исхудание мышц кисти, онемение, которое не проходит в покое.</li>
          <li>Голень: внезапный односторонний отёк с болью или покраснением — срочно.</li>
          <li>Сердце: давящая боль в груди, необычная одышка, обморочность, перебои.</li>
        </ul>
      </section>`,

    food: `
      <section class="card">
        <h3>Цифры</h3>
        <div class="kpis">
          <div class="kpi"><b>{{protLo}}–{{protHi}} г</b><span>белка в день (1,8–2,0 г/кг)</span></div>
          <div class="kpi"><b>3–4</b><span>приёма по 35–50 г</span></div>
          <div class="kpi"><b>−0,2…−0,35 кг</b><span>в неделю — фаза 1</span></div>
          <div class="kpi"><b>3–5 г</b><span>креатина каждый день</span></div>
        </div>
        <p>Польза белка для мышц выходит на плато около 1,6 г/кг, верхняя граница доверительного интервала — примерно 2,2 {morton18}. В лёгком дефиците держимся ближе к верхней части.</p>
      </section>
      <section class="card">
        <h3>Белок при слабом аппетите — пример дня ≈ 170 г</h3>
        <ul class="dots">
          <li>Завтрак: творог 250 г + 2 яйца — ≈ 50 г.</li>
          <li>Обед: салат с мясом, 200 г готового мяса — ≈ 50 г.</li>
          <li>Перекус: порция протеина — ≈ 25 г (кефир 0,5 л даст ≈ 15 г).</li>
          <li>Ужин: рыба или мясо 200 г — ≈ 45 г. Плюс хлеб и сыр за день — ещё ≈ 10 г.</li>
          <li>Аппетита нет — пей белок: протеин, кефир, питьевой скир. Жидкое съесть легче, чем ещё одну тарелку.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Углеводы без гарниров</h3>
        <ul class="dots">
          <li>Фрукты и ягоды 2–3 порции в день, хлеб к мясу, картофель, нут, булгур или киноа — прямо в салат, овсянка со скиром, мёд.</li>
          <li>За 1–2 часа до тренировки: скир + банан или мёд, либо бутерброд. Тренировка на 90–120 минут без углеводов проседает.</li>
          <li><b>Сладкое не запрещено.</b> Выбирай нежирное — зефир, пастилу, мармелад, фрукты, мёд — вместо «сахар + жир» (печенье, шоколад, выпечка): у вторых примерно в полтора раза больше калорий на тот же вес.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Фазы</h3>
        <ul class="dots">
          <li><b>Фаза 1 — блоки 1–3 (~15 недель): рекомпозиция с лёгким дефицитом.</b> Средний вес за неделю −0,2…−0,35 кг. Медленное снижение лучше сохраняет мышцы и силу, чем быстрое {garthe11}. Ориентир — минус 3–5 процентных пунктов жира за фазу.</li>
          <li><b>Фаза 2 — медленный набор:</b> +0,25…0,5 кг в месяц (≈ +150–250 ккал в день). При слабом аппетите — через молоко, кефир, смузи.</li>
          <li><b>Честно про набор:</b> при большом стаже реальный темп — 0,5–2 кг сухой массы в год, а погрешность калипера больше годового прироста. Большая цель по массе — цель на годы; прогресс между замерами смотри по силе, обхватам и фото.</li>
        </ul>
      </section>
      <section class="card">
        <h3>Контроль и корректировки</h3>
        <ul class="dots">
          <li>Вес 3–4 раза в неделю утром — смотри среднее за неделю. Талия по пупку раз в две недели, калипер раз в месяц — всё в «Журнале». Фото раз в 6–8 недель — в телефоне, в одном месте и при одном свете.</li>
          <li>Вес стоит 2–3 недели и талия не уходит — минус одна порция сладкого в день (~200 ккал).</li>
          <li>Сила падает или вес уходит быстрее 0,5 кг в неделю — добавь углеводов.</li>
          <li>Креатин 3–5 г каждый день: при приёме 3–4 раза в неделю мышцы могут насыщаться не полностью {kreider17}.</li>
        </ul>
      </section>`,

    science: [
      { h: "Объём решает рост, частота — силу", p: "При равном объёме частота на рост мышц почти не влияет, а больше подходов дают больше роста — с убывающей отдачей {pelland26}. Поэтому руки и икры — среди лидеров по подходам (см. график во вкладке «План») и работают в оба дня, дельты — тоже в оба дня, а двух тренировок в неделю для этого достаточно." },
      { h: "Близость к отказу — для роста, вес — для силы", p: "Рост мышц тем лучше, чем ближе подход к отказу; на силу близость к отказу почти не влияет — там важнее вес на штанге {robinson24}. Изоляцию доводим до 0–1 RIR (безопасно на блоках и тренажёрах), базовые оставляем с 1–3 повторами в запасе — бережём суставы." },
      { h: "Растянутая позиция растит лучше", p: "Разгибания с поднятым плечом против разгибаний вниз {maeo23}, сгибания ног сидя против лёжа {maeo21}, икры с прямым коленом против сидя {kinoshita23}, частичные повторы в растяжении {kassiano23}{pedrosa22}{wolf23}. Отсюда выбор почти каждого упражнения на руки, икры и бёдра. Часть исследований — на нетренированных: направление эффекта переносится, точные проценты могут отличаться." },
      { h: "Повторы — тоже прогрессия", p: "Добавлять повторы так же эффективно для роста, как добавлять вес {plotkin22} — отсюда двойная прогрессия." },
      { h: "Блоки — ради интереса и суставов", p: "Конкретная схема периодизации на рост почти не влияет {moesgaard22}. Смена упражнений росту не мешает и повышает мотивацию — даже случайная смена каждую тренировку дала тот же прирост {bazvalle19}; но слишком частая смена может тормозить прогресс в силе {kassiano22}. Поэтому якоря (жим, подтягивания, икры) постоянны внутри блока, а вспомогательные можно менять хоть каждую неделю." },
      { h: "Суперсеты экономят время", p: "Пары из неконкурирующих мышц сокращают тренировку без потери результата {zhang25}{iversen21}. Отдых больше минуты для роста чуть лучше {singer24} — поэтому экономим на парах, а не на отдыхе." },
      { h: "Подвижность — из силовой с полной амплитудой", p: "Силовая с полной амплитудой улучшает подвижность не хуже растяжки {afonso21}{alizadeh23}. Поэтому нет отдельного «ЛФК-блока»: сплит-присед растягивает сгибатель бедра, румынская — заднюю поверхность, наклонный жим — грудь, а навык блока занимает 2 минуты разминки." },
      { h: "Кардио не мешает росту мышц", p: "Аэробная работа в одной программе с силовой не снижает рост мышц и максимальную силу {schumann22}. Спринты на велосипеде — после силовой." },
      { h: "Два спринта — минимальная доза для VO₂max", p: "Число спринтов сверх двух прироста VO₂max не добавляет {vollaard17}; двух 20-секундных спринтов в 10-минутной сессии достаточно {metcalfe12}. Интервалы 4×4 — классика для VO₂max {helgerud07}; кардиореспираторная форма — один из сильнейших предикторов долголетия {mandsager18}. В исследованиях было три сессии в неделю — у тебя меньше, эффект будет скромнее." },
      { h: "Гибкость по самочувствию", p: "Подстраивать нагрузку под самочувствие работает не хуже фиксированного плана {hickmott22}. Режим «так себе» — метод, а не поблажка." },
      { h: "Разгрузочная неделя", p: "Специалисты сходятся: снижение объёма раз в 4–8 недель — разумная практика {bell23}. У тебя это неделя 5 каждого блока." },
      { h: "Шаги и «перекусы» движения", p: "7000 шагов против 2000 связаны с на 47 % меньшей смертностью {ding25}; короткие интенсивные эпизоды в быту — с на 38–40 % меньшей {stamatakis22}. Это наблюдательные данные: связь, а не доказанная причина — но направление однозначное." },
      { h: "Привычка — через «если → то»", p: "Конкретный план «если X, то Y» заметно повышает шанс сделать задуманное {gollwitzer06}; привычка становится автоматической в среднем за 66 дней, и пропуск одного дня её не ломает {lally10}." }
    ]
  }
};
