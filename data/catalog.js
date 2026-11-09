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
          { id: "sample-2", label: "サンプル 第2回", file: "data/it/ip/sample-2.js" },
          { id: "sample-1", label: "サンプル 第1回", file: "data/it/ip/sample-1.js" }
        ]
      },
      {
        id: "fe",
        name: "基本情報技術者試験",
        description: "ITエンジニアの登竜門となる国家試験（科目A形式）",
        years: [
          { id: "sample-1", label: "サンプル 第1回", file: "data/it/fe/sample-1.js" }
        ]
      },
      {
        id: "ap",
        name: "応用情報技術者試験",
        description: "ワンランク上のITエンジニア向け国家試験（午前形式）",
        years: [
          { id: "sample-1", label: "サンプル 第1回", file: "data/it/ap/sample-1.js" }
        ]
      }
    ]
  }
];
