const methods = [
  {
    name: "地占术 · 基本盾图",
    text: "16行正整数先按奇偶形成4母图，4女图由转置产生。侄图、证人与裁判逐行XOR合成，共15位；没有额外调和者或十二宫断法。每个图位可查看输入行或父图。自动每行5–36是本站约定，亲手点沙每行最多128粒。",
    url: "https://swh.princeton.edu/~ezb/geomancy/agrippa.html",
    source: "Turner 1655 · Of Geomancy",
  },
  {
    name: "咖啡渣占 · 人工观纹",
    text: "先根据本地随机参数和已记录的转动形成团块、流痕与留白，再由你观察和框选。本站20条意象词典不冒充统一传统判词。杯口／壁／底来自标注位置；俯视与展开是同一杯纹。可选择未看清，并为同一图样保存新的观察版本。",
    url: "https://goturkiye.com/blog/turkish-coffee-culture",
    source: "GoTürkiye · 土耳其咖啡文化流程",
  },
  {
    name: "Ifá · òpèlè 符号体验",
    text: "从操作者视角，链条自由端在下方，先读右列、每列从上往下。凹面朝上用单划，凸面用双划；16个基础图式组合覆盖256种签名。不把欧洲地占含义移植到Ifá。本版没有取得可逐项使用的传统诗节语料，结果会明确说明缺失；本站反思不属于ẹsẹ Ifá。",
    url: "https://ich.unesco.org/en/RL/ifa-divination-system-00146",
    source: "UNESCO · Ifá传统与口传解释者的角色",
  },
  {
    name: "掷筊 · 朝上的面决定类别",
    text: "一平一凸为圣筊，两平为笑筊，两凸为阴筊。数字模拟按两枚独立公平二值生成，不把三种类别等概率抽取，不代表真实木筊的概率。命题在开始前确认，完整保留否定；三次全圣为可选本站模式，不代表统一庙宇礼法。",
    url: "https://tlc.tyc.edu.tw/temples/changxiang-palace/",
    source: "桃园在地化课程 · 长祥宫",
  },
  {
    name: "灼甲观兆 · 历史流程体验",
    text: "使用虚拟甲片和程序化裂纹，不要求动物材料或真实加热。问题、个人观察、馆藏历史案例和后来发生的事分别记录。裂纹没有古法吉凶译码，不自动生成甲骨文，不参与方向汇总。",
    url: "https://asia-archive.si.edu/learn/for-educators/teaching-china-with-the-smithsonian/lesson-plans/making-sense-of-the-future-the-oracle-bone-and-shang-dynasty-divination/",
    source: "Smithsonian · 甲骨历史流程与记录",
  },
];
export function ExperienceLibrary() {
  return (
    <details className="experience-info-card">
      <summary>新增五个篇章 · 方法与资料边界</summary>
      <p>
        这些篇章的操作、计算、纹样与记录均在本地完成，不发送给 DeepSeek
        补写传统判词；所用图形为本站绘制。来源页面仅供主动查阅，离线体验不需要打开它们。
      </p>
      {methods.map((m) => (
        <section key={m.name}>
          <h3>{m.name}</h3>
          <p>{m.text}</p>
          <a href={m.url} target="_blank" rel="noreferrer">
            {m.source}
          </a>
        </section>
      ))}
    </details>
  );
}
