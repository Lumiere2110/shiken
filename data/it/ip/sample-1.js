// ITパスポート試験 サンプル 第1回（オリジナル練習問題）
registerExam({
  genre: "it",
  exam: "ip",
  year: "sample-1",
  title: "ITパスポート試験 サンプル 第1回",
  timeLimit: 15,          // 制限時間（分）
  passingRate: 60,        // 合格ライン（%）
  source: "本リポジトリのオリジナル練習問題（実際の過去問ではありません）",
  questions: [
    {
      category: "テクノロジ系",
      text: "10進数の 13 を2進数で表したものはどれか。",
      choices: ["1011", "1101", "1110", "1001"],
      answer: 1,
      explanation: "13 = 8 + 4 + 1 = 2³ + 2² + 2⁰ なので 1101 となる。"
    },
    {
      category: "テクノロジ系",
      text: "OSS（オープンソースソフトウェア）に関する記述として、適切なものはどれか。",
      choices: [
        "ソースコードが公開されているが、改変は一切認められない。",
        "ライセンスの条件に従えば、利用・改変・再配布ができる。",
        "無償で配布されるため、著作権は放棄されている。",
        "商用目的での利用は必ず禁止されている。"
      ],
      answer: 1,
      explanation: "OSSは著作権を放棄したものではなく、ライセンス（GPL、MITなど）の条件の範囲で利用・改変・再配布ができる。商用利用が可能なものも多い。"
    },
    {
      category: "マネジメント系",
      text: "プロジェクトの作業を階層的に分解し、管理しやすい単位にまとめた図表はどれか。",
      choices: ["WBS", "PERT図", "パレート図", "特性要因図"],
      answer: 0,
      explanation: "WBS（Work Breakdown Structure）は、成果物や作業を階層的に分解したもの。PERT図は作業の順序関係と日程、パレート図は重点分析、特性要因図は原因の整理に使う。"
    },
    {
      category: "ストラテジ系",
      text: "企業の内部環境の強み・弱みと、外部環境の機会・脅威を整理する分析手法はどれか。",
      choices: ["PPM分析", "SWOT分析", "ABC分析", "3C分析"],
      answer: 1,
      explanation: "SWOT分析は Strength（強み）、Weakness（弱み）、Opportunity（機会）、Threat（脅威）の4つの観点で整理する。"
    },
    {
      category: "テクノロジ系",
      text: "情報セキュリティの3要素（CIA）に含まれないものはどれか。",
      choices: ["機密性", "完全性", "可用性", "拡張性"],
      answer: 3,
      explanation: "CIAは Confidentiality（機密性）、Integrity（完全性）、Availability（可用性）。拡張性は含まれない。"
    },
    {
      category: "ストラテジ系",
      text: "著作権法によって保護されるものはどれか。",
      choices: [
        "プログラム言語そのもの",
        "アルゴリズム（解法）",
        "作成したプログラムのソースコード",
        "プログラムの規約（プロトコル）"
      ],
      answer: 2,
      explanation: "著作権法ではプログラムの著作物（ソースコードなど）は保護されるが、プログラム言語、規約、解法（アルゴリズム）は保護の対象外。"
    },
    {
      category: "テクノロジ系",
      text: "Webサイトのアドレスを入力したとき、ドメイン名をIPアドレスに変換する仕組みはどれか。",
      choices: ["DHCP", "DNS", "NAT", "SMTP"],
      answer: 1,
      explanation: "DNS（Domain Name System）はドメイン名とIPアドレスを対応付ける。DHCPはIPアドレスの自動割当て、NATはアドレス変換、SMTPはメール送信のプロトコル。"
    },
    {
      category: "マネジメント系",
      text: "PDCAサイクルの「C」に当たる活動はどれか。",
      choices: ["計画を立てる", "計画を実行する", "実行結果を評価する", "改善を行う"],
      answer: 2,
      explanation: "Plan（計画）→ Do（実行）→ Check（評価）→ Act（改善）。"
    }
  ]
});
