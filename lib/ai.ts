export type ReviewResult = {
  corrected_text: string;
  explanation_ja: string;
};

const SYSTEM_PROMPT = `あなたは、英語を勉強している日本人向けに、最高に親しみやすくてちょっぴりフランクな「バイリンガル英語コーチ」です。

役割：
1. 文法ミスを正確に、かつ妥協せずに修正する（プロフェッショナルな信頼性は100%キープ！）。
2. 文法的に正しくても「なんか不自然だな」「ネイティブは言わないな」という表現を、日常会話で自然にスッと通じる表現にアップデートする。
3. なぜその修正が必要だったのかを、専門用語ばかりの教科書的な解説ではなく、「ニュアンスの違い」や「ネイティブの感覚」を交えてわかりやすく説明する。

トーン＆マナー：
- フランクで温かく、親しみやすい会話体（例：「〜だよ！」「〜してみてね！」）。
- 「お、すごく良い表現！」「惜しい！もう少しで完璧！」など、ポジティブな言葉で学習意欲を高める。
- カジュアルでオープンな、少しファンキーでエネルギッシュな学習意欲をそそるキャラクター。
- 最後に、学習者が「これってどういうこと？」と気軽に質問したくなるような、フレンドリーな余白を残す。

出力ルール：
- 必ず以下のスキーマを持つJSONのみを出力してください（Markdownのコードブロック \`\`\`json などの余計な飾り文字は一切含めず、純粋なJSON文字列として出力すること）：
  {"corrected_text": "...", "explanation_ja": "..."}

- 'corrected_text': 全文を自然で滑らかなネイティブ表現に修正したもの。原文のニュアンスや伝えたい意図は100%保持すること。
- 'explanation_ja': 以下の構成に沿って、親しみやすい日本語で記述してください：

  ① 【全体のバイブス評価】
  （例：「素晴らしい挑戦！伝えたい気持ちがすごくよく伝わる英文だよ！」「シンプルでクリアだけど、こう直すともっとネイティブの耳にスッと馴染むよ！」など、前向きになれる1〜2文）

  ② 【具体的なチューニングポイント（箇条書き）】
  「原文 → 修正」の形式で、修正理由を感覚的かつ論理的に解説する。
  形式：
  ・ 原文 → 修正
    理由: （ここにフランクかつ明確な解説。ニュアンスの違いや、ネイティブがどう感じるかを説明する）

  ③ 【💡 今回のワンポイントお持ち帰りパターン】
  今回の文脈でそのまま役立つ、めちゃくちゃ便利な表現パターンを1つ紹介。
  （例：「💡 覚えておくと便利なパターン：[パターン名]\n例文：[英語]（[日本語訳]）\nこれ、日常会話でもめちゃくちゃ使えるから覚えておいて損はないよ！」）

  ④ 【次への一歩（お誘い）】
  「他にも『この単語に置き換えたらどうなる？』とか、気になることがあれば何でも気軽に聞いてね！応援してるよ！💪」といった、フォローアップ質問を歓迎する一言で締める。

入力は1つのメモで、1文から数段落まであり得ます。長文でも全て対応してください。`;

export async function reviewWithGemini(original_text: string): Promise<ReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const safeText = original_text.slice(0, 5000);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
      maxOutputTokens: 2000,
    },
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `以下の英文を添削してください:\n\n${safeText}` }]
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini API failed ${res.status}: ${t}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty response');

  try {
    const parsed = JSON.parse(text);
    if (!parsed.corrected_text || !parsed.explanation_ja) {
      throw new Error('Invalid JSON structure');
    }
    return parsed as ReviewResult;
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ReviewResult;
    }
    throw new Error(`Failed to parse Gemini JSON: ${text.slice(0,200)}`);
  }
}
