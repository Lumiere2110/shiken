/*
 * 試験カタログ
 *
 * ジャンル → 試験の種類 → 年度（回）の3階層で登録します。
 * 各「年度」の file には問題データ（data/ 以下の .js）を指定します。
 * 追加方法は README.md を参照してください。
 */
window.EXAM_CATALOG = [
  {
    id: "it",
    name: "情報系",
    description: "IPA の情報処理技術者試験など",
    exams: [
      {
        id: "ip",
        name: "ITパスポート試験",
        description: "ITを利活用する社会人・学生向けの国家試験",
        years: [
          { id: "r08", label: "令和8年度 公開問題", file: "data/it/ip/r08.js" },
          { id: "r07", label: "令和7年度 公開問題", file: "data/it/ip/r07.js" },
          { id: "r06", label: "令和6年度 公開問題", file: "data/it/ip/r06.js" }
        ]
      },
      {
        id: "fe",
        name: "基本情報技術者試験",
        description: "ITエンジニアの登竜門となる国家試験（科目A形式）",
        years: [
          { id: "r08a", label: "令和8年度 公開問題 科目A", file: "data/it/fe/r08a.js" },
          { id: "r08b", label: "令和8年度 公開問題 科目B", file: "data/it/fe/r08b.js" },
          { id: "r07a", label: "令和7年度 公開問題 科目A", file: "data/it/fe/r07a.js" },
          { id: "r07b", label: "令和7年度 公開問題 科目B", file: "data/it/fe/r07b.js" }
        ]
      },
      {
        id: "ap",
        name: "応用情報技術者試験",
        description: "ワンランク上のITエンジニア向け国家試験（科目A＝旧午前・多肢選択式／科目B＝旧午後・記述式）",
        years: [
          { id: "r07a", label: "令和7年度 秋期 午前（科目A）", file: "data/it/ap/r07a.js" },
          { id: "r07a-pm", label: "令和7年度 秋期 午後（科目B・記述式）", file: "data/it/ap/r07a_pm.js" },
          { id: "r07h", label: "令和7年度 春期 午前（科目A）", file: "data/it/ap/r07h.js" },
          { id: "r06a", label: "令和6年度 秋期 午前（科目A）", file: "data/it/ap/r06a.js" }
        ]
      }
    ]
  },
  {
    id: "en",
    name: "英語",
    description: "英検・TOEIC などの英語の試験",
    exams: [
      {
        id: "eiken",
        name: "英検",
        description: "日本英語検定協会の実用英語技能検定",
        years: []
      },
      {
        id: "toeic",
        name: "TOEIC",
        description: "ETS が実施する英語コミュニケーション能力テスト（L&R）",
        years: []
      }
    ]
  },
  {
    id: "elec",
    name: "電気・電子",
    description: "電気主任技術者試験など電気・電子の試験",
    exams: [
      {
        id: "denken3",
        name: "第三種電気主任技術者試験",
        description: "電験三種。理論・電力・機械・法規の4科目からなる国家試験",
        years: []
      }
    ]
  }
];
