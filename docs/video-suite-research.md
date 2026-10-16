# מחקר: ערכת עריכת וידאו לרילס בעברית (אוקטובר 2026)

המטרה: שכל רילס עברי ייצא "בפעם אחת". נכנסים תמונה או סרטון והקריינות, ויוצא רילס גמור. בלי להמציא את התהליך מחדש בכל פעם.

המסמך מסכם את המחקר שעליו נשען הסקיל `reel-maker`: מה בדקנו, מה בחרנו, למה, ומה עלה בבדיקות בפועל.

**הערה על המקורות:** החיפוש נעשה מתוך סביבת ענן שחוסמת חלק מהאתרים (elevenlabs.io, huggingface.co ורוב אתרי החדשות). לכן חלק מהמחירים נלקחו מסיכומים של צד שלישי ולא מדף התמחור הרשמי. פריטים כאלה מסומנים **(לא מאומת)**. לפני קנייה בודקים את המחיר בתוך האפליקציה.

---

## תקציר ההחלטות

| תחום | ברירת מחדל | חלופה / גיבוי | למה |
|---|---|---|---|
| תמלול ותזמון מילים | ElevenLabs Scribe דרך ה-connector | ivrit.ai (Whisper turbo מכוונן לעברית) על ה-Mac, בחינם ואופליין | Scribe מדויק ועובד מהענן, אבל **לא חינמי**: הערכה ל-13 שניות יצאה בערך 15 קרדיטים. ivrit.ai הוא המודל הפתוח הטוב ביותר לעברית |
| כתוביות באיות מדויק | יישור התמלול לתסריט הידוע (`words.mjs align`) | stable-ts או WhisperX ליישור ברמת פונמה | בלי מודלים: האיות מגיע מהתסריט והתזמון מהתמלול |
| גרפיקת נתונים | התבניות השחור-זהב של ClipCraft | — | כבר קיימות, נבדקו ומתאימות לסגנון |
| טיפוגרפיה בתנועה, רשימות, כתוביות עם הדגשת מילה, כריכה | **Remotion**: קליפים נפרדים ש-ClipCraft מייבא כשכבות | — | עברית ו-RTL מושלמים, כי הרינדור נעשה ב-Chromium. רישיון חינמי ליחיד ולעסק עד 3 עובדים |
| מגיש | הקלטה של המשתמש, או תמונה עם התקרבות איטית | קריקטורה של המשתמש בכמה תנוחות; אווטאר מדבר (Dreamina בחינם, אחר כך בתשלום) | OmniHuman נחסם בתוכנית החינמית. קריקטורה עם תנוחות זולה ונראית טוב |
| הסרת רקע | rembg עם `u2net_human_seg`, ולקריקטורות `isnet-general-use` | birefnet-portrait לאיכות מרבית | רישיונות פתוחים, רץ על CPU. **לא** להשתמש ב-bria (שימוש לא-מסחרי בלבד) |
| מאוזן ל-9:16 | OpenCV: זיהוי פנים, חלוקה לשוטים, חיתוך קבוע לכל שוט | — | Google AutoFlip לא נתמך מאז 2023 |
| קאטים (שתיקות ומילות מילוי) | לפי תזמון המילים (`jumpcut.mjs`) | auto-editor, לפי עוצמת קול בלבד | חיתוך מדויק לפריים, והכתוביות זזות יחד עם החיתוך |
| סאונד | מוזיקה שמתנמכת מתחת לקול, ו-loudnorm בשני מעברים ל-‎−14 LUFS / −1.5 dBTP | — | יעד בטוח לשלוש הפלטפורמות |
| כריכה | Remotion Still מפריים של המגיש | — | עברית נכונה, והכותרת בתוך אזור החיתוך 3:4 של הגריד |

---

## 1. תמלול ותזמון מילים

| אפשרות | עברית | תזמון מילים | עלות | איפה רץ | רישיון |
|---|---|---|---|---|---|
| **ElevenLabs Scribe** (v1 ב-connector; v2 ב-API) | ElevenLabs מציגים WER של 3.1% ב-FLEURS לעברית, אבל זו טענת היצרן ויש סתירה בגרפים שלהם | כן, ברמת מילה | בערך ‎$0.22 לשעה ב-API **(לא מאומת)**. ב-connector: הערכה של כ-15 קרדיטים ל-13 שניות | ענן | קנייני. בתוכנית החינמית אין רישיון מסחרי |
| OpenAI `gpt-4o-transcribe` | טוב | **לא** | ‎$0.006 לדקה | ענן | קנייני |
| OpenAI `whisper-1` | Whisper רגיל | כן | ‎$0.006 לדקה | ענן | קנייני |
| **ivrit.ai whisper-large-v3-turbo** (גרסאות ct2 ו-ggml) | המודל הפתוח הטוב ביותר לעברית. צד שלישי מדד WER של 7–9% על מבחני עברית | כן (דרך המריץ) | חינם | ה-Mac, אופליין | Apache-2.0 לפי מראה אחת **(לא מאומת בכרטיס הרשמי)** |
| mlx-whisper | Whisper רגיל | כן | חינם | GPU של Apple. בערך פי 2 מהיר מ-whisper.cpp | MIT |
| whisper.cpp (Metal) | לפי המודל | כן (`-ml 1 -sow`) | חינם | Mac | MIT |
| faster-whisper | לפי המודל | כן | חינם | CPU ב-Mac | MIT |

**החלטה:**
- בענן: Scribe, עם הערכת עלות לפני כל ריצה.
- על ה-Mac: `transcribe.sh` עם ivrit.ai (faster-whisper ו-int8).
- כשהתסריט ידוע: יישור התמלול לתסריט בתוך הסקיל, בלי מודלים.

**יישור כפוי** (forced alignment, כשהטקסט ידוע מראש):
- stable-ts (`align()`) עם מודל ivrit, או WhisperX עם מודל wav2vec2 עברי. שניהם מדויקים ברמת פונמה.
- MMS/ctc-forced-aligner: המשקולות ברישיון CC-BY-NC, ובעברית בלי ניקוד הוא חלש (מאמר HebDB). לא מתאים.
- aeneas: רישיון AGPL, ברמת משפט בלבד. לא מתאים.

**הגבלה בסביבת הענן:** אין GPU ואין גישה ל-Hugging Face. לכן Whisper מקומי רץ רק על המחשב של המשתמש.

## 2. גרפיקה בתנועה

| כלי | איכות | רינדור בלי ממשק | שקיפות | עברית ו-RTL | רישיון |
|---|---|---|---|---|---|
| **Remotion 4.0.535** | גבוהה (React, CSS, SVG) | כן (`renderMedia`) | WebM ב-VP8/VP9 עם alpha, או ProRes 4444 | מצוין: DOM של Chromium | חינם ליחיד ולעסק עד 3 אנשים. מעבר לזה $25 למושב לחודש ומעלה **(מחירים לא מאומתים)** |
| Revideo | גבוהה (canvas) | כן | לא נבדק | bidi על canvas שביר | MIT |
| Motion Canvas | גבוהה | לא (כפתור בממשק) | — | canvas | MIT. **לא שוחרר מאז 2024** |
| Lottie / dotLottie | תלוי בקובץ | דרך Remotion | כן | טקסט עברי חלש | MIT, ולכל אנימציה רישיון משלה |
| Rive | גבוהה, אינטראקטיבית | אין ייצוא וידאו רשמי | — | לא נבדק | MIT (ה-runtime) |

**החלטה: לשלב את Remotion לצד ClipCraft, לא במקומו.**
- ClipCraft נשאר העורך שמרכיב ומייצא.
- Remotion מרנדר קליפים קצרים: כותרת קינטית, רשימה ממוספרת, כתוביות עם הדגשת המילה הנאמרת ברקע שקוף, וכריכה.
- כל הקליפים נבדקו בפועל בסביבה הזו, עם Chromium מקומי וגופנים מ-npm, בלי הורדות.

**תיקון שנדרש ב-ClipCraft:** המפענח המובנה של FFmpeg ל-VP9 משמיט את שכבת השקיפות. לכן הייצוא יצא עם מלבן שחור. התיקון: ה-probe מזהה `alpha_mode`, והייצוא מפענח את השכבה עם `libvpx-vp9`. נוספה לכך בדיקת יחידה.

**מוקשים בעברית:**
- `direction: rtl` על כל מכל טקסט.
- `<bdi>` סביב מספרים, אחוזים ומטבעות, כדי שהסדר לא יתהפך.
- בלי `letter-spacing` על עברית.
- גופנים: Heebo, Rubik ו-Assistant ברישיון OFL, חינם לווידאו מסחרי.

## 3. מגיש מתמונה: אווטאר מדבר וקריקטורה

אף כלי לא מצהיר על תמיכה בסנכרון שפתיים בעברית. המודלים עוקבים אחרי הצליל, אז זה בדרך כלל עובד, אבל חובה לבדוק 10 שניות לפני תשלום.

| כלי | עלות משוערת | חינם | הערות |
|---|---|---|---|
| **OmniHuman 1.5** ב-Dreamina (CapCut), דרך Avatar Pro | — | **120 קרדיטים ביום** | האיכות החינמית הטובה ביותר. המשתמש מעלה את התמונה וה-MP3 בעצמו |
| OmniHuman 1.5 ב-ElevenLabs | תוכנית Starter ב-$6 לחודש | לא | **נחסם בתוכנית החינמית.** לפי התיעוד לא זמין בארה"ב |
| OmniHuman ב-Freepik או Magnific | 180 קרדיטים לשנייה | — | יתרת Magnific של המשתמש: 0 |
| OmniHuman 1.5 ב-fal.ai | ‎$0.16 לשנייה (בערך ‎$9.60 לדקה) | — | עד 30 שניות ב-1080p. ה-API הטוב ביותר |
| HeyGen Avatar IV | Creator ב-$29 לחודש. API: ‎$0.05 לשנייה | 3 סרטונים בחודש, עם סימן מים | ראש ופלג גוף עליון |
| Hedra Character-3 | בערך $2–3.6 לדקה | ניסיון עם סימן מים | טוב לדמויות מאוירות |
| Kling Avatar 2.0 | ‎$0.06–0.12 לשנייה (fal) | — | חלופה זולה |
| Runway Act-Two | 5 קרדיטים לשנייה | — | מונע מווידאו מקליד, לא מאודיו. לא מתאים |
| Veo 3.1 | ‎$0.10–0.40 לשנייה | — | מייצר דיבור משלו ולא משתמש בקריינות. לא מתאים |
| מודלים פתוחים: InfiniteTalk (Apache), Wan 2.2 S2V/Animate (Apache), LongCat-Video-Avatar (MIT) | GPU שכור | — | צריכים 24–80GB VRAM. על Mac איטי מדי (לפי מדידה אחת, 82 דקות ל-2 שניות על M1 Max) |

**הסולם שבחרנו:**
1. המשתמש מקליט את עצמו. זו האפשרות הטובה ביותר, והיא חינמית.
2. תמונה עם קריינות והתקרבות איטית.
3. **קריקטורה של המשתמש בכמה תנוחות:**
   - מודל תמונה שומר על הדמיון: Nano Banana בערך ‎$0.04, או gpt-image או Seedream.
   - עורכים את הקריקטורה עצמה לתנוחות: מצביע, אגודל, חושב.
   - `cutout.py` מסיר את הרקע.
   - מחליפים תנוחות על המילים, בלי סנכרון שפתיים.
4. אווטאר מדבר דרך Dreamina, בחינם עם מגבלה יומית.
5. בתשלום: Hedra או HeyGen, ולאיכות מרבית fal.ai.

**בטיחות:** מנפישים ומשבטים רק את הפנים והקול של המשתמש עצמו.

## 4. אבני בניין נוספות

**הסרת רקע:**
- rembg ברישיון MIT, עם `u2net_human_seg` לאנשים, `isnet-general-use` לאיורים ו-`birefnet-portrait` לשיער ולקצוות.
- **bria-rmbg / RMBG-2.0 ברישיון CC-BY-NC: לא להשתמש.**
- לווידאו:
  - RobustVideoMatting: יציב בין פריימים, אבל ברישיון GPL-3.0.
  - MediaPipe: מהיר, אבל הקצוות גסים.
  - על Mac: Apple Vision (חינם).
- בבדיקה כאן: תמונה בכ-8 שניות על CPU.

**מאוזן לאנכי:**
- AutoFlip לא נתמך מאז 1.3.2023.
- הגישה המקובלת: זיהוי פנים, החלקה, חיתוך ב-FFmpeg.
- בחרנו חיתוך קבוע לכל שוט, כי למגיש מדבר זה נראה הכי מקצועי ואין רעידות.
- OpenCV 5 הסיר את מזהה הפנים המובנה, לכן נעוצים על `<5`.

**קאטים:**
- `jumpcut.mjs` חותך לפי תזמון המילים. מסיר הפסקות ארוכות מ-0.35 שניות ואת "אממ", "אה" ו"הממ".
- המילים "כאילו" ו"בעצם" לא נחתכות אוטומטית, כי לעיתים הן מילים אמיתיות.
- auto-editor (Unlicense) הוא חלופה לפי עוצמת קול.
- בבדיקה: מ-13.2 ל-9.5 שניות.

**צילומי מקור:**
- Playwright בלוקאל עברי ובקנה מידה 2x.
- חוסם את ספקי ה-consent הנפוצים, ממסגר כ"כרטיס מקור" 1080×1920 עם הדומיין.
- אתרי חדשות רבים חוסמים בוטים. אז משתמשים בצילום מסך מהטלפון.

**ספריות סטוק:**
- Pexels: חינם עם API key, מסחרי ובלי ייחוס.
- Pixabay: מסחרי, אבל אסור להפיץ את הקבצים כמו שהם.

**מוזיקה ואפקטים:**
- ElevenLabs Music עולה בערך 900 קרדיטים לדקה, ומסחרי רק בתוכניות בתשלום **(לא מאומת)**.
- עדיף מוזיקה של המשתמש או ספרייה חופשית.
- מיקס: sidechaincompress מנמיך את המוזיקה כשהקול מדבר.

**עוצמה:**
- ‎−14 LUFS ו-‎−1.5 dBTP, ב-loudnorm בשני מעברים, עם `-ar 48000`.
- יוטיוב רק מנמיך. היעדים של טיקטוק ואינסטגרם לא רשמיים.
- בבדיקה: מ-‎−22.2 ל-‎−13.9 LUFS.

**כריכה ואזורים בטוחים:**
- הכריכה מועלית ב-1080×1920, והגריד של אינסטגרם חותך ל-3:4 (‏1080×1440).
- אזור בטוח משותף לטקסט: x בין 60 ל-890, y בין 290 ל-1250.
- נמנעים מ-670 הפיקסלים התחתונים ומ-190 הימניים (שם הכפתורים).

**מפרט ייצוא:**
- 1080×1920, 30fps, H.264 High, yuv420p, בערך 8–12Mbps.
- AAC ב-48kHz, ‏192kbps, עם `+faststart`.
- אורך: Shorts עד 3 דקות. Reels עד 3 דקות כדי להופיע בהמלצות.

---

## 5. מה נבנה ונבדק

הכול נבדק בסביבה הזו, עם ClipCraft האמיתי תחת `xvfb-run` ומדיה שנוצרה לבדיקה:
- **תמונה:** Grace Hopper, נחלת הכלל.
- **קריינות:** בעברית, ב-espeak-ng, מילה-מילה, כדי לקבל תזמון מדויק בלי לבזבז קרדיטים.

| בדיקה | תוצאה |
|---|---|
| ריצה A: תמונה, קריינות, יישור לתסריט, קאטים, 5 סצנות (שנה, Remotion KineticTitle, עמודות, מספר, ‏Remotion ListReveal), כתוביות ClipCraft, מוזיקה וכריכה | עבר: 1080×1920, ‏10.4 שניות, ‎−13.9 LUFS. כל שלב ביחד לקח בערך דקה |
| ריצה B: סרטון אופקי, reframe לפי פנים, קאטים, כרטיס צילום מקור, כרטיס ציטוט, כתוביות Remotion שקופות | עבר, אחרי תיקון השקיפות ב-ClipCraft ובניית UI עדכנית |
| בדיקות יחידה לספריית המילים (Scribe, Whisper, whisper.cpp, יישור, ביטויים, קאטים, SRT) | ‏9/9 |
| בדיקות יחידה של ClipCraft | ‏47/47, כולל הבדיקה החדשה לשכבות שקופות |

**באגים שנמצאו ותוקנו בדרך:**
- שכבה שקופה יצאה שחורה. נוסף מפענח alpha, וגם שומר שמסרב לרוץ על build ישן של הממשק.
- ברירת המחדל `$` של גרף העמודות דלפה ל"600 דק׳".
- הכתוביות כיסו רשימות וצילומי מסך במסך מלא. עכשיו הן יורדות למטה, בתוך האזור הבטוח.
- גרפיקה שהסצנה שלה ארוכה מ-4 שניות נחתכה. עכשיו משך הגרפיקה שווה לאורך הסצנה.
- המיפוי בין סצנות לשכבות זז כשהיו סצנות `face`.
- סצנות קצרות מדי מקבלות עכשיו אזהרה.
- **אומדן Scribe:** בערך 15 קרדיטים ל-13 שניות, ולא 0 כפי שהנחנו.

---

## מקורות

**תמלול**
- https://elevenlabs.io/speech-to-text/hebrew: עמוד העברית של Scribe (טענת 3.1% WER)
- https://developer.puter.com/tutorials/elevenlabs-api-pricing/: מחירי Scribe v2 (צד שלישי)
- https://soniox.com/compare-stt/soniox-vs-elevenlabs/hebrew: ביקורת של מתחרה על Scribe בעברית
- https://www.costbench.com/software/ai-voice-tools/elevenlabs/free-plan/: בתוכנית החינמית אין רישיון מסחרי
- https://diyai.io/ai-tools/speech-to-text/openai-whisper-api-pricing-2026/: מחירי OpenAI, ו-gpt-4o-transcribe בלי תזמון מילים
- https://huggingface.co/ivrit-ai, https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2: המודלים של ivrit.ai
- https://pypi.org/project/ivrit/: חבילת ivrit עם תזמון מילים
- https://notes.billmill.org/dev_blog/2026/01/updated_my_mlx_whisper_vs._whisper.cpp_benchmark.html: השוואת mlx-whisper ל-whisper.cpp
- https://huggingface.co/imvladikon/wav2vec2-xls-r-300m-hebrew: מודל יישור עברי ל-WhisperX
- https://docs.pytorch.org/audio/stable/tutorials/forced_alignment_for_multilingual_data_tutorial.html: MMS_FA ו-uroman
- https://arxiv.org/pdf/2407.07566: HebDB (יישור עברית בלי ניקוד)

**גרפיקה בתנועה**
- https://github.com/remotion-dev/remotion/blob/main/LICENSE.md: רישיון Remotion
- https://www.remotion.dev/docs/transparent-videos: וידאו שקוף (VP8/VP9 עם yuva420p, ו-ProRes 4444)
- https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell: `browserExecutable`
- https://www.remotion.dev/docs/captions/create-tiktok-style-captions: כתוביות בסגנון TikTok
- https://www.remotion.dev/docs/ai/skills: Agent Skills הרשמיים
- https://www.remotion.dev/docs/license/pricing: תמחור (לא נפתח ישירות)
- https://github.com/midrender/revideo: Revideo
- https://www.remotion.dev/docs/compare/motion-canvas: Motion Canvas מול Remotion
- https://help.lottiefiles.com/hc/en-us/articles/900002438343: רישיון LottieFiles

**אווטאר ומגיש**
- https://fal.ai/learn/devs/omnihuman-15-user-guide: OmniHuman 1.5 ב-fal (‏$0.16 לשנייה, מגבלות אורך)
- https://elevenlabs.io/docs/overview/capabilities/image-video: OmniHuman ב-ElevenLabs
- https://support.freepik.com/s/article/AI-Video-Generator-Credits: 180 קרדיטים לשנייה ב-Freepik
- https://dreamina.capcut.com/ai-video/free-image-to-video-generator-credits-faq: 120 קרדיטים חינם ביום ב-Dreamina
- https://www.heygen.com/pricing, https://openrouter.ai/heygen/avatar-iv: HeyGen
- https://dailyaifixs.com/blog/hedra-pricing-2026-credits-burn-by-the-second: Hedra
- https://poyo.ai/models/kling-avatar-2-0: Kling Avatar
- https://github.com/MeiGen-AI/InfiniteTalk, https://huggingface.co/meituan-longcat/LongCat-Video-Avatar: מודלים פתוחים
- https://replicate.com/fofr/live-portrait/readme: LivePortrait (משקולות InsightFace לא-מסחריות)
- https://bfl.ai/pricing/licensing: הרישיון של FLUX Kontext [dev]
- https://github.com/Bria-AI/RMBG-2.0: ‏CC BY-NC 4.0

**אבני בניין**
- https://github.com/danielgatis/rembg: rembg ומודלים
- https://github.com/PeterL1n/RobustVideoMatting: ‏GPL-3.0
- https://developers.google.com/edge/mediapipe/solutions/guide: AutoFlip, "Support ended"
- https://github.com/WyattBlue/auto-editor: auto-editor
- https://github.com/apify/idcac: חסימת באנרי עוגיות
- https://www.forasoft.com/learn/audio-for-video/articles-audio/lufs-targets-per-platform-2026: יעדי LUFS לפי פלטפורמה
- https://www.hopperhq.com/blog/instagram-reel-size/: חיתוך 3:4 בגריד
- https://www.socialync.io/tools/safe-zones/youtube-shorts, https://www.upload-post.com/tools/safe-zone-checker/: אזורים בטוחים
- https://blitzcutai.com/blog/social-video-specs-2026: מפרטי ייצוא
