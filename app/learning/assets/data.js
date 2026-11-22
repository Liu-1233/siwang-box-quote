/* ============================================================
 * 丝网盒子 · 丝网英语学习 —— 内容数据
 * ------------------------------------------------------------
 * 全部课程内容都在这一个文件里。要加句子、改翻译，
 * 直接改下面 units 里的 items 就行，不用动页面代码。
 *
 * item 结构：
 *   句子课   { id, en, zh, tip }        tip = 什么时候用
 *   单词课   { id, en, ph, zh, pos, ex, exZh }
 *   计划课   { id, en, zh, tip, label } label = Day N · 主题
 * ============================================================ */
window.SW_COURSES = {
  order: ['koudai', 'whatsapp', 'words', 'planA', 'planB'],

  list: {

    /* ================= 1. 安平档口开口一百句 ================= */
    koudai: {
      id: 'koudai',
      title: '安平档口开口一百句',
      tag: '句子课',
      type: 'sentence',
      desc: '门店、档口、展会现场用得上的极简英语。不抠语法，先把生意谈下去。',
      units: [
        {
          name: '一、招呼客户',
          items: [
            { id: 'kd01', en: 'Welcome! Come in and take a look.', zh: '欢迎，进来看看。', tip: '客户走进档口第一句，别急着推销。' },
            { id: 'kd02', en: 'Are you looking for anything special today?', zh: '今天想看点什么？', tip: '比"What do you want"礼貌得多。' },
            { id: 'kd03', en: 'Where are you from?', zh: '您从哪儿来？', tip: '破冰神句，问完就能聊市场。' },
            { id: 'kd04', en: 'First time here? Let me show you around.', zh: '第一次来？我带您转转。', tip: '带客户走一圈，比站着说管用。' },
            { id: 'kd05', en: 'Take your time, no rush.', zh: '慢慢看，不着急。', tip: '客户沉默时用，消除压迫感。' }
          ]
        },
        {
          name: '二、介绍产品',
          items: [
            { id: 'kd06', en: 'This is our stainless steel wire mesh, 304 grade.', zh: '这是我们的不锈钢丝网，304 材质。', tip: '开口先报材质等级，客户最关心这个。' },
            { id: 'kd07', en: 'We make woven mesh, welded mesh and expanded metal.', zh: '我们做编织网、焊接网和钢板网。', tip: '一句话说清产品线。' },
            { id: 'kd08', en: "Here's a sample you can take with you.", zh: '这里有个样品，您可以带走。', tip: '样品是最好成交工具，一定主动给。' },
            { id: 'kd09', en: 'This one is our best seller.', zh: '这款是我们的爆款。', tip: '给客户一个"别人都在买"的理由。' },
            { id: 'kd10', en: "Made in Anping — most of China's wire mesh comes from here.", zh: '安平产的——中国的丝网大部分都出自这里。', tip: '产地就是背书，一定要说出来。' }
          ]
        },
        {
          name: '三、报价',
          items: [
            { id: 'kd11', en: 'Let me write you a price.', zh: '我给您报个价。', tip: '写在纸上或手机上，客户觉得正式。' },
            { id: 'kd12', en: 'This price is FOB Tianjin.', zh: '这个价格是天津港 FOB。', tip: '一定说清贸易术语，避免后面扯皮。' },
            { id: 'kd13', en: 'The price depends on the mesh count and wire diameter.', zh: '价格取决于目数和丝径。', tip: '客户嫌贵时，先把变量摆出来。' },
            { id: 'kd14', en: 'For 100 rolls, we can do a better price.', zh: '订 100 卷的话，价格可以再优惠。', tip: '用价格换数量，别白降价。' },
            { id: 'kd15', en: 'This quote is valid for 15 days.', zh: '这个报价 15 天内有效。', tip: '给客户一点时间压力，但不逼人。' }
          ]
        },
        {
          name: '四、议价',
          items: [
            { id: 'kd16', en: "That's below our cost, I'm afraid.", zh: '这个价恐怕低于我们的成本。', tip: '被压到成本线以下时的标准回应。' },
            { id: 'kd17', en: 'Let me check with my manager.', zh: '我问一下我们经理。', tip: '别当场答应，给自己留缓冲。' },
            { id: 'kd18', en: 'If you increase the quantity, we can meet you halfway.', zh: '如果加量，我们可以各让一步。', tip: '"meet you halfway"是议价万能句。' },
            { id: 'kd19', en: "I can't go lower on price, but I can improve the payment terms.", zh: '价格降不了，但付款条件可以谈。', tip: '价格底线守住，用别的条件换。' },
            { id: 'kd20', en: "Let's split the difference.", zh: '我们各让一半吧。', tip: '僵住时收尾用，双方都有台阶。' }
          ]
        },
        {
          name: '五、确认规格',
          items: [
            { id: 'kd21', en: 'Let me confirm the specifications with you.', zh: '我跟您确认一下规格。', tip: '下单前必须走这一步，别靠记忆。' },
            { id: 'kd22', en: 'Mesh count, wire diameter, width and length.', zh: '目数、丝径、幅宽和长度。', tip: '四要素，一个一个念给客户听。' },
            { id: 'kd23', en: 'Do you need it in rolls or cut pieces?', zh: '您要卷装还是开片？', tip: '包装方式影响成本和运费。' },
            { id: 'kd24', en: "What's the tolerance you can accept?", zh: '您能接受的公差是多少？', tip: '专业感的体现，客户会当场记住你。' },
            { id: 'kd25', en: "I'll send you the spec sheet to sign back.", zh: '我把规格单发您，您回签一下。', tip: '回签=留证据，后期纠纷少九成。' }
          ]
        },
        {
          name: '六、交期包装收款',
          items: [
            { id: 'kd26', en: 'Lead time is about 20 days after deposit.', zh: '定金到账后交期约 20 天。', tip: '"after deposit"必须说，别只讲天数。' },
            { id: 'kd27', en: 'We pack it in waterproof paper, then on wooden pallets.', zh: '我们用防水纸包装，再打木托。', tip: '客户担心海运受潮，这句能安他心。' },
            { id: 'kd28', en: '30% deposit, balance against the copy of B/L.', zh: '30% 定金，余款见提单复印件付。', tip: '常见付款方式，说清"copy of B/L"。' },
            { id: 'kd29', en: "I'll send you the photos before shipment.", zh: '发货前我给您拍照片。', tip: '主动给，客户会觉得你靠谱。' },
            { id: 'kd30', en: 'Nice doing business with you.', zh: '合作愉快。', tip: '送客时用，简单得体。' }
          ]
        },
        {
          name: '七、客户嫌贵说别家便宜',
          items: [
            { id: 'kd31', en: "I understand, but let me show you why ours costs a bit more.", zh: '我理解，不过我让您看看为什么我们的贵一点。', tip: '先认同再解释，别一上来就反驳。' },
            { id: 'kd32', en: "Same mesh count doesn't mean the same quality.", zh: '同样目数不代表同样质量。', tip: '丝径差 0.02mm，手感和寿命完全不一样，这是关键差异点。' },
            { id: 'kd33', en: 'Our wire is from a certified mill, with test reports.', zh: '我们的钢丝出自有资质的钢厂，带检测报告。', tip: '用"来源"讲质量，比空口说"我们质量好"可信十倍。' },
            { id: 'kd34', en: "If you only need the lowest price, that's fine too. But let me show you the two side by side.", zh: '如果您只要最低价，也可以。不过让我把两款并排放给您看。', tip: '两卷网摆在一起，客户自己会选。' },
            { id: 'kd35', en: 'Cheap mesh rusts in one season. Ours lasts years.', zh: '便宜网一个季度就锈，我们的能用好几年。', tip: '户外工程客户最吃这句。' }
          ]
        },
        {
          name: '八、寄样与运费',
          items: [
            { id: 'kd36', en: "I'll send you a free sample today.", zh: '我今天就给您寄免费样品。', tip: '"free"说在前面，先让客户爽快。' },
            { id: 'kd37', en: "Can you cover the courier charge? We'll refund it on your first order.", zh: '快递费您先承担，首单我们退给您。', tip: '既挡住白嫖，又留了后路。' },
            { id: 'kd38', en: 'The sample will arrive in about 5 days by DHL.', zh: 'DHL 大约 5 天到。', tip: '给具体时效，客户好安排。' },
            { id: 'kd39', en: "I'll send you the tracking number tonight.", zh: '今晚我把单号发您。', tip: '主动给单号，不用客户催。' },
            { id: 'kd40', en: 'Please count the mesh yourself when the sample arrives.', zh: '样品到了请自己数一下目数。', tip: '教客户自己验，成交后少纠纷。' }
          ]
        },
        {
          name: '九、定制与打样',
          items: [
            { id: 'kd41', en: 'We can make it to your drawing.', zh: '我们可以按您的图纸做。', tip: '定制能力直接说，客户会觉得你专业。' },
            { id: 'kd42', en: 'Custom size takes about 7 days for the first sample.', zh: '定制尺寸首样约 7 天。', tip: '打样周期先讲清，别让客户天天催。' },
            { id: 'kd43', en: 'What tolerance do you need on the wire diameter?', zh: '丝径公差您要求多少？', tip: '公差问出口，报价才准。' },
            { id: 'kd44', en: 'We can laser-cut it to any shape you need.', zh: '我们可以按您需要的形状激光切割。', tip: '特殊形状用 laser-cut 这个词，客户一听就懂。' },
            { id: 'kd45', en: "The sample is free, but the mould charge isn't.", zh: '样品免费，但模具费要另收。', tip: '冲孔网类定制常遇到模具费，提前说清不尴尬。' }
          ]
        },
        {
          name: '十、展会摊位现场',
          items: [
            { id: 'kd46', en: 'Hi! Are you looking for wire mesh?', zh: '您好！在找丝网吗？', tip: '展会开场直接问需求，别问"Can I help you"。' },
            { id: 'kd47', en: "Here's our catalogue — page 12 is our hot seller.", zh: '这是我们的目录，第 12 页是爆款。', tip: '直接翻到那一页，省客户时间。' },
            { id: 'kd48', en: "We're from Anping, the biggest mesh production base in China.", zh: '我们来自安平，中国最大的丝网生产基地。', tip: '展会自我介绍先报产地。' },
            { id: 'kd49', en: 'Can I have your card? I will send you the price list today.', zh: '能留张名片吗？我今天就把价格表发您。', tip: '展会拿到名片=拿到跟进许可。' },
            { id: 'kd50', en: "Nice meeting you! I'll email you tonight so you don't forget us.", zh: '很高兴认识您！今晚我就发邮件，您别把我们忘了。', tip: '展会当天跟进邮件，回复率最高。' }
          ]
        },
        {
          name: '十一、工厂参观',
          items: [
            { id: 'kd51', en: 'Welcome to our factory. Safety shoes first, please.', zh: '欢迎来我们工厂，请先穿安全鞋。', tip: '安全提示显得管理规范。' },
            { id: 'kd52', en: 'This is our welding line — it runs 24 hours.', zh: '这是我们的焊网生产线，24 小时运转。', tip: '产能实力用产线说话。' },
            { id: 'kd53', en: 'We have 5 welding machines and 12 looms.', zh: '我们有 5 台焊机和 12 台织机。', tip: '报设备数量，客户心里能估算你的产能。' },
            { id: 'kd54', en: 'You can check any roll you like.', zh: '哪卷您想检查都可以。', tip: '主动让客户验货，底气足才敢说。' },
            { id: 'kd55', en: 'Shall we start with a trial order of 200 rolls?', zh: '我们先来个小单试 200 卷怎么样？', tip: '参观结束就提小单，趁热打铁。' }
          ]
        },
        {
          name: '十二、质量异议与售后',
          items: [
            { id: 'kd56', en: 'Sorry about that. Can you send me a photo?', zh: '很抱歉。能拍张照片给我吗？', tip: '先道歉再看证据，别急着辩解。' },
            { id: 'kd57', en: "We'll replace the damaged ones at our cost.", zh: '损坏的我们免费补发。', tip: '小损失换大信任，别算小账。' },
            { id: 'kd58', en: "This is a shipping problem, not a quality problem. We'll handle it together.", zh: '这是运输问题不是质量问题，我们一起来解决。', tip: '分清责任，但别把客户推出去。' },
            { id: 'kd59', en: "Let's do a full inspection before the next shipment.", zh: '下批发货前我们做全检。', tip: '给出改进动作，客户才敢继续下单。' },
            { id: 'kd60', en: "I'll have our QC team check the remaining stock today.", zh: '我今天就让质检团队查一下库存。', tip: '24 小时内给反馈，是黄金时间。' }
          ]
        },
        {
          name: '十三、老客户回访与复购',
          items: [
            { id: 'kd61', en: 'How is the mesh working out for you?', zh: '那批网用得怎么样？', tip: '回访第一句问使用情况，别问"还要货吗"。' },
            { id: 'kd62', en: 'Any feedback from your customers?', zh: '您的客户有反馈吗？', tip: '终端反馈比什么都值钱。' },
            { id: 'kd63', en: 'The zinc coating cost just went up. Want to lock in this quarter price?', zh: '镀锌成本刚涨了，想锁定这个季度价格吗？', tip: '涨价前促单的标准话术。' },
            { id: 'kd64', en: "We've added a new 200-mesh spec you might like.", zh: '我们新上了 200 目的规格，您可能感兴趣。', tip: '用新品找复购理由，别只会问"要不要"。' },
            { id: 'kd65', en: 'Same as last time, or anything to adjust?', zh: '和上次一样，还是有什么要调整的？', tip: '老客户复购最快的一句。' }
          ]
        },
        {
          name: '十四、大单谈判',
          items: [
            { id: 'kd66', en: 'For a full container, we can give you a special price.', zh: '整柜的话可以给您特价。', tip: '大单必须给"special"的感觉。' },
            { id: 'kd67', en: 'Let me show you the price breakdown, no hidden costs.', zh: '我把价格拆开给您看，没有隐藏费用。', tip: '拆开算=透明，客户放心。' },
            { id: 'kd68', en: 'At this quantity, our factory can reserve a production line for you.', zh: '这个量我们可以给您专线生产。', tip: '专线=优先级，值得写进谈判。' },
            { id: 'kd69', en: 'We can sign an annual agreement with fixed quarterly prices.', zh: '我们可以签年度协议，按季度固定价。', tip: '长期锁客思路，先做起来。' },
            { id: 'kd70', en: 'This is our best price. It works only with payment by T/T in advance.', zh: '这是我们的最低价，但只接受预付 T/T。', tip: '价格和付款条件绑在一起谈。' }
          ]
        },
        {
          name: '十五、汇率波动与调价',
          items: [
            { id: 'kd71', en: 'The exchange rate moved against us this month.', zh: '这个月汇率对我们不利。', tip: '涨价解释从汇率切入，客户能理解。' },
            { id: 'kd72', en: 'Steel price went up 5%, so we have to adjust a little.', zh: '钢价涨了 5%，我们得稍微调一点。', tip: '调价幅度具体化，客户不慌。' },
            { id: 'kd73', en: "If you confirm this week, I'll keep the old price.", zh: '这周确认的话，我按原价给您。', tip: '永远给一个"现在下单"的理由。' },
            { id: 'kd74', en: 'We can fix the price for 30 days after the contract.', zh: '合同签好后价格 30 天内有效。', tip: '价格保护期，减少客户顾虑。' },
            { id: 'kd75', en: "I'm not raising your price — the material cost is, unfortunately.", zh: '不是我要涨，是材料成本在涨。', tip: '把"我"和"涨价"分开，客户不迁怒你。' }
          ]
        },
        {
          name: '十六、电话沟通',
          items: [
            { id: 'kd76', en: 'Hello, this is Bai from Anping Siwang Box.', zh: '您好，我是安平丝网盒子的白。', tip: '电话开场报姓名+公司。' },
            { id: 'kd77', en: "Is now a good time? It'll take two minutes.", zh: '现在方便吗？两分钟就好。', tip: '问时间+限时，接通率高。' },
            { id: 'kd78', en: 'Can you hear me clearly?', zh: '听得清楚吗？', tip: '开场确认线路，避免后面重复。' },
            { id: 'kd79', en: 'Let me send you the details by email after this call.', zh: '通话后我把详情发您邮箱。', tip: '电话里说不清的，邮件补。' },
            { id: 'kd80', en: "Sorry to call you so late — it's morning here in China.", zh: '抱歉这么晚打给您，我们这边是早上。', tip: '时差道歉+解释，显得有教养。' }
          ]
        },
        {
          name: '十七、介绍新产品',
          items: [
            { id: 'kd81', en: "We've just launched a PVC-coated welded mesh.", zh: '我们刚上了 PVC 覆塑电焊网。', tip: '新品用"just launched"，有新鲜感。' },
            { id: 'kd82', en: "It's stronger and doesn't rust for 10 years.", zh: '更结实，十年不生锈。', tip: '两个卖点一句说完，别堆术语。' },
            { id: 'kd83', en: 'Want me to send a sample to your office?', zh: '要我寄个样品到您办公室吗？', tip: '新品推样品，门槛低。' },
            { id: 'kd84', en: 'Your competitor just bought this one.', zh: '您的同行刚买了这款。', tip: '慎用，但对果断型客户有效。' },
            { id: 'kd85', en: 'This is the one we sell the most this year.', zh: '这是我们今年卖得最好的一款。', tip: '从众心理，展会档口通用。' }
          ]
        },
        {
          name: '十八、寒暄与节日',
          items: [
            { id: 'kd86', en: "How's the weather there?", zh: '您那边天气怎么样？', tip: '万能寒暄，尤其换季时。' },
            { id: 'kd87', en: 'Did you watch the game last night?', zh: '昨晚看球了吗？', tip: '找到客户兴趣点，关系就近了。' },
            { id: 'kd88', en: 'Happy Spring Festival! The factory reopens on the 8th.', zh: '春节快乐！我们初八开工。', tip: '节日祝福带复工信息，一举两得。' },
            { id: 'kd89', en: 'How was your holiday?', zh: '假期过得怎么样？', tip: '长假后第一句，比谈生意更暖。' },
            { id: 'kd90', en: 'Take care of yourself and your family.', zh: '您和家人多保重。', tip: '客户生病或困难时用，人情味。' }
          ]
        },
        {
          name: '十九、客户转介绍',
          items: [
            { id: 'kd91', en: 'Do you know anyone else who needs mesh?', zh: '您还认识谁需要丝网吗？', tip: '直接问，满意客户会乐意介绍。' },
            { id: 'kd92', en: 'We can give you a small commission for any referral order.', zh: '介绍的订单我们可以给您一点佣金。', tip: '利益驱动，注意合规表述。' },
            { id: 'kd93', en: 'I can send you some samples to share with your friends.', zh: '我可以寄些样品给您带给朋友。', tip: '给客户"送礼"的由头。' },
            { id: 'kd94', en: 'Your friend mentioned you — glad to meet you.', zh: '您朋友提过您，很高兴认识您。', tip: '转介绍客户的开场，信任度直接拉满。' },
            { id: 'kd95', en: 'We treat your friends just like we treat you.', zh: '您的朋友我们一样对待。', tip: '让介绍人放心，不担心朋友被坑。' }
          ]
        },
        {
          name: '二十、离开前的收尾',
          items: [
            { id: 'kd96', en: 'Let me walk you out.', zh: '我送您出去。', tip: '档口送客是基本礼数。' },
            { id: 'kd97', en: "I'll call you tomorrow with the price.", zh: '明天我打电话给您报价。', tip: '给承诺+给时间点。' },
            { id: 'kd98', en: 'Safe travels, and talk soon.', zh: '一路平安，回头聊。', tip: '客户远道而来，这句很暖。' },
            { id: 'kd99', en: "Don't hesitate to reach out — day or night.", zh: '有任何事随时找我，白天晚上都行。', tip: '让客户觉得你一直在。' },
            { id: 'kd100', en: 'Thank you for coming. Hope to see you again.', zh: '感谢您来，期待再见。', tip: '收尾标准句，简单真诚。' }
          ]
        }
      ]
    },

    /* ================= 2. WhatsApp 沟通一百句 ================= */
    whatsapp: {
      id: 'whatsapp',
      title: 'WhatsApp 沟通一百句',
      tag: '句子课',
      type: 'sentence',
      desc: '客户不回怎么办、怎么催单不尴尬、怎么报涨价客户能接受。真实聊天场景，直接复制就能发。',
      units: [
        {
          name: '一、初次联系',
          items: [
            { id: 'wa01', en: 'Hi John, this is Bai from Siwang Box in Anping, China. We met at the Canton Fair.', zh: '你好 John，我是安平丝网盒子的白，我们在广交会见过。', tip: '第一句必须报身份 + 在哪见过，否则被当骚扰。' },
            { id: 'wa02', en: "We're a wire mesh manufacturer. May I send you our catalogue?", zh: '我们是丝网生产厂家，可以发份目录给您吗？', tip: '先问再发，回复率高很多。' },
            { id: 'wa03', en: 'Just following up on my last message.', zh: '跟进一下我上条消息。', tip: '最短的跟进开场，不啰嗦。' },
            { id: 'wa04', en: 'Could you share your email so I can send the full spec?', zh: '方便给个邮箱吗？我把完整规格发您。', tip: '拿到邮箱=拿到正式沟通渠道。' },
            { id: 'wa05', en: 'No pressure at all — just keeping you in the loop.', zh: '不着急，就是给您同步一下。', tip: '给客户减负，他不会反感你。' }
          ]
        },
        {
          name: '二、客户不回怎么跟进',
          items: [
            { id: 'wa06', en: 'Just checking if you had a chance to look at my message.', zh: '想确认下您有没有看到我的消息。', tip: '三到五天后用，语气最软。' },
            { id: 'wa07', en: "I've attached the updated price list for your reference.", zh: '附上最新价格表供您参考。', tip: '给一个"新理由"再打扰，不算催。' },
            { id: 'wa08', en: 'Is there anything I can help with?', zh: '有什么我能帮上忙的吗？', tip: '把话题从"买不买"转到"帮不帮"。' },
            { id: 'wa09', en: "If the timing isn't right, I'll follow up next month.", zh: '如果现在不是时候，我下个月再联系您。', tip: '给客户台阶，他反而更容易回你。' },
            { id: 'wa10', en: "Still interested? Just say the word and I'll get back to you.", zh: '还有兴趣吗？您说一声我就回复您。', tip: '最后一次跟进用，干脆。' }
          ]
        },
        {
          name: '三、催单',
          items: [
            { id: 'wa11', en: 'Just a gentle reminder about the pending order.', zh: '提醒一下那个待确认的订单。', tip: '"gentle reminder"比"any update"体面。' },
            { id: 'wa12', en: 'Could you let me know your decision by Friday?', zh: '能在周五前给我个答复吗？', tip: '给具体日期，别问"什么时候"。' },
            { id: 'wa13', en: 'We need to book the production line, so a quick reply would help.', zh: '我们要排产线，麻烦尽快回复。', tip: '给一个客观理由，不是你在催。' },
            { id: 'wa14', en: 'Shall I keep the price for you until the end of the month?', zh: '要帮您把价格保留到月底吗？', tip: '制造合理紧迫感，不显得压迫。' },
            { id: 'wa15', en: 'Any update on your side?', zh: '您那边有进展吗？', tip: '四个词，最轻的催单。' }
          ]
        },
        {
          name: '四、报价后跟进',
          items: [
            { id: 'wa16', en: 'Did you get a chance to review our quotation?', zh: '您看到我们的报价了吗？', tip: '报价后第二天用。' },
            { id: 'wa17', en: 'Is the price within your budget?', zh: '这个价格在您预算内吗？', tip: '直接问，比"觉得怎么样"有效。' },
            { id: 'wa18', en: "Let me know if you'd like a different spec or quantity.", zh: '如果规格或数量要调整，告诉我。', tip: '引导客户砍规格而不是砍价。' },
            { id: 'wa19', en: 'We can adjust the packing to save you freight.', zh: '我们可以调整包装帮您省运费。', tip: '客户卡在总价时，运费是突破口。' },
            { id: 'wa20', en: "I've attached a comparison so you can see what changed.", zh: '附了个对比表，方便您看变化。', tip: '改过价格就必须给对比，不然客户不信。' }
          ]
        },
        {
          name: '五、涨价怎么说',
          items: [
            { id: 'wa21', en: "I'm sorry to tell you that the raw material price went up.", zh: '很抱歉，原材料涨价了。', tip: '先说抱歉，再讲事实，别拐弯。' },
            { id: 'wa22', en: 'We held the old price as long as we could.', zh: '我们尽可能久地扛住了原价。', tip: '让客户知道你为他扛过成本。' },
            { id: 'wa23', en: 'The new price starts from the 1st of next month.', zh: '新价格从下月 1 号起执行。', tip: '给明确生效日，客户好做决定。' },
            { id: 'wa24', en: "If you confirm before then, we'll honor the old price.", zh: '如果在那之前确认，我们按老价格执行。', tip: '这一步能把涨价通知变成促单。' },
            { id: 'wa25', en: "I'd rather tell you early than surprise you later.", zh: '我宁愿早点告诉您，也不想后面让您措手不及。', tip: '金句，直接把信任拉满。' }
          ]
        },
        {
          name: '六、售后与投诉',
          items: [
            { id: 'wa26', en: "I'm sorry to hear that. Let me look into it right away.", zh: '很抱歉，我马上查。', tip: '客户投诉第一句，先接情绪不辩解。' },
            { id: 'wa27', en: 'Could you send me a photo of the problem?', zh: '能发张问题的照片吗？', tip: '要证据，但语气是配合不是质疑。' },
            { id: 'wa28', en: "We'll arrange a replacement in the next shipment.", zh: '我们在下一批货里给您补上。', tip: '老客户首选方案，成本最低。' },
            { id: 'wa29', en: 'This is on us — no charge.', zh: '这个算我们的，不收费。', tip: '该认就认，一次赔付换长期订单。' },
            { id: 'wa30', en: 'Thank you for telling us, it helps us improve.', zh: '谢谢您告诉我们，这能帮我们改进。', tip: '收尾用，把投诉变成关系升级。' }
          ]
        },
        {
          name: '七、寄样沟通',
          items: [
            { id: 'wa31', en: 'Sample is ready. What is your full address?', zh: '样品好了，您的完整地址发我一下。', tip: '要地址一次问全：公司、门牌、城市、邮编、电话。' },
            { id: 'wa32', en: "I'll ship it by DHL today, tracking tonight.", zh: '今天 DHL 寄出，晚上把单号发您。', tip: '寄样+单号一步到位。' },
            { id: 'wa33', en: 'The sample is free; the courier fee is USD 45.', zh: '样品免费，快递费 45 美元。', tip: '费用透明，别事后说。' },
            { id: 'wa34', en: 'Can you send me a photo after you check the sample?', zh: '收到样品后能拍张照片给我吗？', tip: '照片=证据，也是下次联系的由头。' },
            { id: 'wa35', en: 'If the sample works, we can talk about the first order.', zh: '样品合适的话，我们可以聊首单了。', tip: '寄样时就埋下单钩子。' }
          ]
        },
        {
          name: '八、确认规格细节',
          items: [
            { id: 'wa36', en: 'Before the order, let me confirm the details.', zh: '下单前，我跟您确认下细节。', tip: '文字确认=留痕，纠纷少一半。' },
            { id: 'wa37', en: '100 mesh, 0.10mm wire, 1.22m wide, 30m per roll — correct?', zh: '100 目、0.10 丝径、幅宽 1.22 米、每卷 30 米——对吗？', tip: '四要素念一遍，让客户回 confirm。' },
            { id: 'wa38', en: 'Galvanized or stainless? Please confirm again.', zh: '镀锌还是不锈钢？请再确认。', tip: '材质最容易搞错，问两遍不夸张。' },
            { id: 'wa39', en: 'Your address and phone number for the shipping label.', zh: '收货地址和电话，贴单用。', tip: '电话必须留，快递找不到人很常见。' },
            { id: 'wa40', en: "I'll send the spec sheet. Please sign and send it back.", zh: '我把规格单发您，您签个字回传。', tip: '回传=正式确认，别只在聊天里说。' }
          ]
        },
        {
          name: '九、发 PI 与单据',
          items: [
            { id: 'wa41', en: "I've sent the PI to your email. Please check.", zh: 'PI 已发您邮箱，请查收。', tip: '说清发哪儿了，别让客户到处找。' },
            { id: 'wa42', en: 'The PI number is PI-20261014-01.', zh: 'PI 编号是 PI-20261014-01。', tip: '编号报出来，后续查单方便。' },
            { id: 'wa43', en: 'Payment details are on the last page of the PI.', zh: '付款信息在 PI 最后一页。', tip: '引导客户去看，别重复贴一遍。' },
            { id: 'wa44', en: 'Let me know if anything needs changing.', zh: '有要改的地方随时说。', tip: '给客户修改的台阶，改 PI 不尴尬。' },
            { id: 'wa45', en: "Once you confirm the PI, I'll arrange production.", zh: 'PI 确认后我就安排生产。', tip: '把确认和生产挂上钩，客户会尽快回。' }
          ]
        },
        {
          name: '十、付款与定金',
          items: [
            { id: 'wa46', en: 'Could you send us the bank slip once the deposit is paid?', zh: '定金到账后能把水单发我吗？', tip: '水单是财务确认的关键。' },
            { id: 'wa47', en: "We've received the deposit, thank you!", zh: '定金已收到，谢谢！', tip: '到账必确认，客户最在意这个。' },
            { id: 'wa48', en: 'The balance will be due before shipment.', zh: '余款在发货前付清。', tip: '提前说清，避免最后一天扯皮。' },
            { id: 'wa49', en: 'We accept T/T and L/C at sight.', zh: '我们接受 T/T 和即期信用证。', tip: '一次说清付款方式范围。' },
            { id: 'wa50', en: 'Production starts within 24 hours of the deposit.', zh: '定金到账 24 小时内开工。', tip: '用"24小时"体现效率。' }
          ]
        },
        {
          name: '十一、生产与交期更新',
          items: [
            { id: 'wa51', en: 'Your order is in production now.', zh: '您的订单正在生产中。', tip: '主动汇报，客户不用问。' },
            { id: 'wa52', en: "We're about 60% done. On schedule.", zh: '大约完成 60%，按计划。', tip: '百分比+结论，一目了然。' },
            { id: 'wa53', en: 'The steel wire arrived today.', zh: '今天钢丝到了。', tip: '原材料到位=交期有谱，客户爱听。' },
            { id: 'wa54', en: "We'll send photos when the goods are packed.", zh: '包装完成后我发照片给您。', tip: '承诺具体动作和时间点。' },
            { id: 'wa55', en: "There's a 3-day delay because of the machine. Sorry about that.", zh: '机器原因要延迟 3 天，抱歉。', tip: '坏消息早说+道歉+给准信，别等客户来问。' }
          ]
        },
        {
          name: '十二、验货与发货',
          items: [
            { id: 'wa56', en: 'Your goods passed our final inspection today.', zh: '您的货物今天通过终检。', tip: '主动报喜，客户放心。' },
            { id: 'wa57', en: 'Here are the loading photos.', zh: '这是装柜照片。', tip: '装柜照片是催尾款的利器。' },
            { id: 'wa58', en: 'B/L will be issued in 2 days.', zh: '提单两天内出。', tip: '提单时间直接影响客户付款。' },
            { id: 'wa59', en: "The vessel sails tomorrow, ETA 25th.", zh: '船明天开，预计 25 日到。', tip: '给 ETA，客户好安排清关。' },
            { id: 'wa60', en: "I'll send you the documents by email tonight.", zh: '今晚我把单据发您邮箱。', tip: '提单、发票、箱单一起发，别分次。' }
          ]
        },
        {
          name: '十三、到港与清关协助',
          items: [
            { id: 'wa61', en: 'The vessel arrived this morning. Please arrange pickup.', zh: '船今早到了，请安排提货。', tip: '到港即通知，滞港费很贵。' },
            { id: 'wa62', en: "I'll send the customs documents again, just in case.", zh: '清关单据我再发一份，以防万一。', tip: '主动备份，客户会记你的好。' },
            { id: 'wa63', en: 'Do you need the certificate of origin for customs?', zh: '清关需要原产地证吗？', tip: '主动问，有些国家要 CO 才能清关。' },
            { id: 'wa64', en: 'Let me know if the customs needs anything from us.', zh: '海关那边需要什么配合随时说。', tip: '让客户知道你不是发完货就消失。' },
            { id: 'wa65', en: 'Has the cargo been released?', zh: '货物放行了吗？', tip: '跟进到放行，服务才算完。' }
          ]
        },
        {
          name: '十四、质量问题处理',
          items: [
            { id: 'wa66', en: 'Sorry to hear that. Can you send photos of the problem?', zh: '听到这个很抱歉，问题照片能发我吗？', tip: '先道歉，再要证据。' },
            { id: 'wa67', en: "We'll cover the replacement and the freight.", zh: '补发的货和运费我们来承担。', tip: '爽快认下来，信任能挽回。' },
            { id: 'wa68', en: 'Our QC will check the whole batch today.', zh: '我们质检今天全查这批货。', tip: '给动作，客户就有信心。' },
            { id: 'wa69', en: "We'll add an extra inspection before the next shipment.", zh: '下批发货前我们加一道全检。', tip: '改进措施写进消息，客户截图存证。' },
            { id: 'wa70', en: 'Thank you for telling us. It helps us improve.', zh: '谢谢您告诉我们，这帮助我们改进。', tip: '把投诉当礼物，客户感受完全不同。' }
          ]
        },
        {
          name: '十五、复购与老客户维护',
          items: [
            { id: 'wa71', en: 'How did the last order sell?', zh: '上一单卖得怎么样？', tip: '问销售情况，不是问"还要货吗"。' },
            { id: 'wa72', en: "We're preparing next month's production. Want to join?", zh: '我们在排下个月的生产，要一起吗？', tip: '"join"让客户感觉是内部人。' },
            { id: 'wa73', en: 'Raw material price is rising. Shall we lock your price now?', zh: '原材料在涨，现在锁定价格吗？', tip: '涨价预警=促单时机。' },
            { id: 'wa74', en: 'We have a new color available — want a sample?', zh: '我们新到了一个颜色，要样品吗？', tip: '新品复购钩子。' },
            { id: 'wa75', en: "It's been a pleasure working with you this year.", zh: '今年和您合作很愉快。', tip: '年末维护感情用，别带销售目的。' }
          ]
        },
        {
          name: '十六、请求评价与转介绍',
          items: [
            { id: 'wa76', en: 'Would you mind writing us a short review?', zh: '方便写个简短评价吗？', tip: '请求具体点，客户才知道写什么。' },
            { id: 'wa77', en: 'Do you know anyone in your network who needs mesh?', zh: '您认识的人里有需要丝网的吗？', tip: '转介绍直接问，满意客户会帮。' },
            { id: 'wa78', en: "We'd love to give your friend the same service.", zh: '您朋友来了我们一样服务。', tip: '打消介绍人"被比下去"的顾虑。' },
            { id: 'wa79', en: "Here's a small gift for your referral. Hope you like it.", zh: '这是给您介绍客户的小礼物，希望喜欢。', tip: '小礼物维持关系，礼轻情意重。' },
            { id: 'wa80', en: 'Your referral order is confirmed. Thank you!', zh: '您介绍的订单确认了，谢谢！', tip: '闭环告知，介绍人有成就感。' }
          ]
        },
        {
          name: '十七、节假日问候',
          items: [
            { id: 'wa81', en: 'Merry Christmas and a Happy New Year!', zh: '圣诞快乐，新年好！', tip: '群发也要带名字，别一眼看出是模板。' },
            { id: 'wa82', en: 'Our factory closes for the holiday from the 20th.', zh: '我们 20 号起放假。', tip: '节日+放假信息，客户好规划订单。' },
            { id: 'wa83', en: "We're back at work today. How can I help?", zh: '我们今天复工了，有什么需要？', tip: '复工消息=自然的复联理由。' },
            { id: 'wa84', en: 'Wishing you a prosperous year ahead.', zh: '祝新的一年生意兴隆。', tip: 'B2B 客户吃这句，真诚不肉麻。' },
            { id: 'wa85', en: 'Happy holidays to you and your team!', zh: '祝您和团队节日快乐！', tip: '带上 team，显得你记得他公司。' }
          ]
        },
        {
          name: '十八、长消息与语音沟通',
          items: [
            { id: 'wa86', en: "It's a long message — let me summarize at the end.", zh: '消息比较长，我在最后总结一下。', tip: '长消息先预告，客户有耐心看。' },
            { id: 'wa87', en: "I've sent a voice message since typing takes long.", zh: '打字太慢，我发了语音。', tip: '语音前说明原因，避免对方不方便听。' },
            { id: 'wa88', en: 'Was my last message clear? Happy to explain again.', zh: '上条消息清楚吗？我可以再解释。', tip: '给客户"不懂"的台阶。' },
            { id: 'wa89', en: 'Let me send you a photo instead of describing it.', zh: '我直接发照片，不用描述了。', tip: '一图胜千言，规格问题尤其适用。' },
            { id: 'wa90', en: "I'll put everything into one file and send it over.", zh: '我把所有资料整理成一个文件发您。', tip: '别连发十几条，整理好再发。' }
          ]
        },
        {
          name: '十九、客户介绍同行',
          items: [
            { id: 'wa91', en: 'My friend Mr. Smith from ABC Trading recommended you.', zh: 'ABC 贸易公司的 Smith 先生介绍我来的。', tip: '第一句就亮出介绍人。' },
            { id: 'wa92', en: 'He said your quality is very reliable.', zh: '他说你们质量很可靠。', tip: '借介绍人的嘴夸自己，不尴尬。' },
            { id: 'wa93', en: "We're looking for the same mesh he buys.", zh: '我们想找他买的同款网。', tip: '同款=规格明确，成交快。' },
            { id: 'wa94', en: 'Hope we can work together as well as you do with him.', zh: '希望我们合作得像您和他一样好。', tip: '礼貌且有暗示：他和你合作很久了。' },
            { id: 'wa95', en: 'Could you share his order spec as a reference?', zh: '方便把给他的订单规格给我参考吗？', tip: '从老客户规格切入新客户。' }
          ]
        },
        {
          name: '二十、结束语与确认收到',
          items: [
            { id: 'wa96', en: 'Does that work for you?', zh: '这样可以吗？', tip: '每段沟通结尾都给一个明确的确认点。' },
            { id: 'wa97', en: "Just confirm and I'll proceed.", zh: '确认一下，我就推进。', tip: '把球踢回客户，流程不停。' },
            { id: 'wa98', en: "I'm here if you need anything else.", zh: '有其他需要随时找我。', tip: '开放式收尾，不催不压。' },
            { id: 'wa99', en: 'Thanks for your quick reply!', zh: '谢谢您的快速回复！', tip: '感谢及时回复，强化客户秒回的习惯。' },
            { id: 'wa100', en: 'Talk to you next week. Have a great weekend!', zh: '下周聊，周末愉快！', tip: '约定下次联系时间，显得有规划。' }
          ]
        }
      ]
    },

    /* ================= 3. 丝网规格高频单词课 ================= */
    words: {
      id: 'words',
      title: '丝网规格高频单词课',
      tag: '单词课',
      type: 'word',
      desc: '按产品、规格、检测分类的高频词，每个词配音标、释义和业务例句。看得懂客户邮件的第一步。',
      units: [
        {
          name: '一、目数与丝径',
          items: [
            { id: 'wd01', en: 'mesh', ph: '/meʃ/', pos: 'n.', zh: '目数；网孔', ex: 'What mesh count do you need?', exZh: '您需要多少目？', tip: '' },
            { id: 'wd02', en: 'mesh count', ph: '', pos: 'n.', zh: '目数', ex: 'The mesh count is 100 per inch.', exZh: '目数是每英寸 100 目。', tip: '' },
            { id: 'wd03', en: 'aperture', ph: '/ˈæpətʃə(r)/', pos: 'n.', zh: '孔径，孔口', ex: 'The aperture is 0.15 mm.', exZh: '孔径是 0.15 毫米。', tip: '比 opening 更书面，规格单上常见。' },
            { id: 'wd04', en: 'wire diameter', ph: '', pos: 'n.', zh: '丝径', ex: 'Wire diameter 0.10 mm, please.', exZh: '请按 0.10 毫米丝径。', tip: '老外也常说 "wire dia."。' },
            { id: 'wd05', en: 'opening', ph: '/ˈəʊpənɪŋ/', pos: 'n.', zh: '孔（尺寸），开口', ex: 'The opening size is measured in microns.', exZh: '孔径尺寸用微米计。', tip: '' },
            { id: 'wd06', en: 'strand', ph: '/strænd/', pos: 'n.', zh: '丝，单根线', ex: 'Broken strands will fail the inspection.', exZh: '断丝会导致验货不通过。', tip: '' }
          ]
        },
        {
          name: '二、编织与结构',
          items: [
            { id: 'wd07', en: 'plain weave', ph: '', pos: 'n.', zh: '平纹编织', ex: 'We supply plain weave stainless mesh.', exZh: '我们供应平纹不锈钢网。', tip: '最常见的编织方式。' },
            { id: 'wd08', en: 'twill weave', ph: '', pos: 'n.', zh: '斜纹编织', ex: 'Twill weave gives better strength.', exZh: '斜纹编织强度更好。', tip: '' },
            { id: 'wd09', en: 'dutch weave', ph: '', pos: 'n.', zh: '荷兰编织（密纹）', ex: 'Dutch weave is used for filtration.', exZh: '荷兰编织多用于过滤。', tip: '过滤行业常问。' },
            { id: 'wd10', en: 'warp', ph: '/wɔːp/', pos: 'n.', zh: '经线', ex: 'Warp and weft are both 0.1 mm.', exZh: '经纬丝都是 0.1 毫米。', tip: '' },
            { id: 'wd11', en: 'weft', ph: '/weft/', pos: 'n.', zh: '纬线', ex: 'The weft wire is slightly thicker.', exZh: '纬丝略粗一点。', tip: '也叫 "woof"，但 weft 更通用。' },
            { id: 'wd12', en: 'selvedge', ph: '/ˈselvɪdʒ/', pos: 'n.', zh: '布边，边丝', ex: 'Reinforced selvedge on both sides.', exZh: '两边加粗边丝。', tip: '卷装网常见要求。' }
          ]
        },
        {
          name: '三、材质与表面',
          items: [
            { id: 'wd13', en: 'stainless steel', ph: '', pos: 'n.', zh: '不锈钢', ex: 'SS304 is the most common grade.', exZh: '304 是最常见的等级。', tip: 'SS304 / SS316 常这么缩写。' },
            { id: 'wd14', en: 'galvanized', ph: '/ˈɡælvənaɪzd/', pos: 'adj.', zh: '镀锌的', ex: 'Hot-dip galvanized mesh for gabions.', exZh: '石笼网用热镀锌。', tip: 'hot-dip 是热镀，electro 是电镀。' },
            { id: 'wd15', en: 'mild steel', ph: '', pos: 'n.', zh: '低碳钢', ex: 'Mild steel is cheaper than stainless.', exZh: '低碳钢比不锈钢便宜。', tip: '' },
            { id: 'wd16', en: 'brass', ph: '/brɑːs/', pos: 'n.', zh: '黄铜', ex: 'Brass mesh is used for decoration.', exZh: '黄铜网用于装饰。', tip: '' },
            { id: 'wd17', en: 'aluminum', ph: '/əˈluːmɪnəm/', pos: 'n.', zh: '铝', ex: 'Aluminum mesh is lightweight.', exZh: '铝网很轻。', tip: '英式拼写 aluminium。' },
            { id: 'wd18', en: 'PVC coated', ph: '', pos: 'adj.', zh: '浸塑的，PVC 涂层的', ex: 'PVC coated mesh in green.', exZh: '绿色浸塑网。', tip: '围栏类产品高频词。' }
          ]
        },
        {
          name: '四、规格与公差',
          items: [
            { id: 'wd19', en: 'specification', ph: '/ˌspesɪfɪˈkeɪʃn/', pos: 'n.', zh: '规格', ex: 'Please check the specification sheet.', exZh: '请核对规格单。', tip: '口语简称 spec。' },
            { id: 'wd20', en: 'tolerance', ph: '/ˈtɒlərəns/', pos: 'n.', zh: '公差', ex: 'Plus or minus 5 percent tolerance.', exZh: '正负 5% 公差。', tip: '客户问质量时先谈公差。' },
            { id: 'wd21', en: 'width', ph: '/wɪdθ/', pos: 'n.', zh: '幅宽', ex: 'Standard width is one meter.', exZh: '标准幅宽 1 米。', tip: '' },
            { id: 'wd22', en: 'length', ph: '/leŋθ/', pos: 'n.', zh: '长度', ex: 'Thirty meters per roll.', exZh: '每卷 30 米。', tip: '' },
            { id: 'wd23', en: 'roll', ph: '/rəʊl/', pos: 'n.', zh: '卷', ex: 'One hundred rolls in one pallet.', exZh: '一个托盘装一百卷。', tip: '' },
            { id: 'wd24', en: 'gauge', ph: '/ɡeɪdʒ/', pos: 'n.', zh: '线规，厚度', ex: 'What gauge of wire do you use?', exZh: '你们用多少号的丝？', tip: '美国客户常用 gauge 代替毫米。' }
          ]
        },
        {
          name: '五、质量与检测',
          items: [
            { id: 'wd25', en: 'quality inspection', ph: '', pos: 'n.', zh: '质量检验', ex: 'Third-party inspection is welcome.', exZh: '欢迎第三方验货。', tip: '主动说欢迎验货，是很强的信号。' },
            { id: 'wd26', en: 'certificate', ph: '/səˈtɪfɪkət/', pos: 'n.', zh: '证书', ex: 'We can provide a mill test certificate.', exZh: '我们可以提供材质单。', tip: 'MTC = mill test certificate，材质证明。' },
            { id: 'wd27', en: 'sample', ph: '/ˈsɑːmpl/', pos: 'n.', zh: '样品', ex: 'A free sample is available.', exZh: '可提供免费样品。', tip: '' },
            { id: 'wd28', en: 'defect', ph: '/ˈdiːfekt/', pos: 'n.', zh: '瑕疵，缺陷', ex: 'Any defect will be replaced.', exZh: '有瑕疵我们会补。', tip: '' },
            { id: 'wd29', en: 'standard', ph: '/ˈstændəd/', pos: 'n.', zh: '标准', ex: 'It meets the ASTM standard.', exZh: '符合 ASTM 标准。', tip: '' },
            { id: 'wd30', en: 'packing list', ph: '', pos: 'n.', zh: '装箱单', ex: 'The packing list is attached.', exZh: '装箱单已附上。', tip: '清关必备三件套之一。' }
          ]
        },
        {
          name: '六、包装与运输',
          items: [
            { id: 'wd31', en: 'pallet', ph: '/ˈpælət/', pos: 'n.', zh: '木托盘', ex: 'We load on standard pallets.', exZh: '我们用标准托盘装载。', tip: '' },
            { id: 'wd32', en: 'waterproof', ph: '/ˈwɔːtəpruːf/', pos: 'adj.', zh: '防水的', ex: 'Waterproof paper inside, carton outside.', exZh: '内防水纸，外纸箱。', tip: '海运客户必问。' },
            { id: 'wd33', en: 'bundle', ph: '/ˈbʌndl/', pos: 'n.', zh: '捆，卷（包装单位）', ex: 'Each bundle weighs about 30 kg.', exZh: '每捆约 30 公斤。', tip: '' },
            { id: 'wd34', en: 'container', ph: '/kənˈteɪnə(r)/', pos: 'n.', zh: '集装箱，货柜', ex: 'One 20GP can hold 120 rolls.', exZh: '一个 20 尺柜能装 120 卷。', tip: '20GP=20 尺平柜，40HQ=40 尺高柜。' },
            { id: 'wd35', en: 'gross weight', ph: '', pos: 'n.', zh: '毛重', ex: 'Gross weight is 18 tons per container.', exZh: '每柜毛重 18 吨。', tip: '对应净重 net weight。' },
            { id: 'wd36', en: 'lead time', ph: '', pos: 'n.', zh: '交期，生产周期', ex: 'Lead time is 20 days after deposit.', exZh: '定金到账后 20 天。', tip: '外贸第一高频词之一。' }
          ]
        },
        {
          name: '七、贸易与单证',
          items: [
            { id: 'wd37', en: 'bill of lading', ph: '', pos: 'n.', zh: '提单', ex: 'We will send the bill of lading after shipment.', exZh: '发货后我们寄提单。', tip: '简称 B/L，提货的凭证。' },
            { id: 'wd38', en: 'certificate of origin', ph: '', pos: 'n.', zh: '原产地证', ex: 'A certificate of origin is required for customs.', exZh: '清关需要原产地证。', tip: '简称 CO。' },
            { id: 'wd39', en: 'letter of credit', ph: '', pos: 'n.', zh: '信用证', ex: 'We accept L/C at sight.', exZh: '我们接受即期信用证。', tip: '简称 L/C，风险低但手续慢。' },
            { id: 'wd40', en: 'proforma invoice', ph: '', pos: 'n.', zh: '形式发票', ex: 'Here is the proforma invoice for your payment.', exZh: '这是付款用的形式发票。', tip: '简称 PI，客户打定金的依据。' },
            { id: 'wd41', en: 'customs declaration', ph: '', pos: 'n.', zh: '报关单', ex: 'We will prepare the customs declaration.', exZh: '我们来准备报关单。', tip: '' },
            { id: 'wd42', en: 'inspection certificate', ph: '', pos: 'n.', zh: '检验证书', ex: 'An inspection certificate is needed before shipment.', exZh: '发货前需要检验证书。', tip: '第三方验货出的证明文件。' }
          ]
        }
      ]
    },

    /* ================= 4. 30 天丝网外贸句子实战 ================= */
    planA: {
      id: 'planA',
      title: '30 天丝网外贸句子实战',
      tag: '30 天主线',
      type: 'sentence',
      desc: '每天 3 句，从找客户到售后，按真实业务流程排序。30 天走完一单全流程。',
      units: [
        { name: 'Day 1 · 找客户', items: [
          { id: 'a101', en: 'Hi, I noticed you import wire mesh. We are a manufacturer in Anping, China.', zh: '你好，我注意到你们进口丝网。我们是安平的生产厂家。', tip: '开发信第一句，先说自己是谁。' },
          { id: 'a102', en: 'Could I send you our product list and prices?', zh: '我可以把产品清单和价格发给您吗？', tip: '问句比陈述句回复率高。' },
          { id: 'a103', en: 'We supply 304 stainless steel mesh from 1 to 500 mesh.', zh: '我们供应 1 到 500 目的 304 不锈钢网。', tip: '一句话说清能力范围。' }
        ]},
        { name: 'Day 2 · 接询盘', items: [
          { id: 'a201', en: 'Thanks for your inquiry about our mesh panels.', zh: '感谢您对我们网板的询盘。', tip: '先致谢，再问需求。' },
          { id: 'a202', en: 'Could you confirm the mesh count and wire diameter you need?', zh: '能确认一下您需要的目数和丝径吗？', tip: '不确认规格就报价，等于白报。' },
          { id: 'a203', en: 'May I know the quantity you are planning to order?', zh: '方便告知您计划订购的数量吗？', tip: '数量决定价格档位。' }
        ]},
        { name: 'Day 3 · 建立信任', items: [
          { id: 'a301', en: 'We have been in wire mesh for over 20 years.', zh: '我们做丝网 20 多年了。', tip: '年限就是可信度。' },
          { id: 'a302', en: 'Here are photos from our workshop and warehouse.', zh: '这是我们车间和仓库的照片。', tip: '照片比文字可信十倍。' },
          { id: 'a303', en: 'Our main markets are Europe, the Middle East and Southeast Asia.', zh: '我们主要市场是欧洲、中东和东南亚。', tip: '有出口经验，客户更放心。' }
        ]},
        { name: 'Day 4 · 寄样品', items: [
          { id: 'a401', en: 'We can send you a free sample by courier.', zh: '我们可以快递免费样品给您。', tip: '样品是成交加速器。' },
          { id: 'a402', en: 'Just cover the freight and we will handle the rest.', zh: '您只要承担运费，其他我们负责。', tip: '这样客户也不好意思白拿。' },
          { id: 'a403', en: 'Which size would you like, 100 mesh or 200 mesh?', zh: '您要哪个规格，100 目还是 200 目？', tip: '给选项，别问开放题。' }
        ]},
        { name: 'Day 5 · 守住价格', items: [
          { id: 'a501', en: 'I understand your price target, but that is below our cost.', zh: '我理解您的目标价，但这低于我们的成本。', tip: '先认同再拒绝，客户不容易翻脸。' },
          { id: 'a502', en: 'Let me offer you an alternative spec that fits your budget.', zh: '我给您推荐一个符合预算的替代规格。', tip: '给方案比给拒绝强。' },
          { id: 'a503', en: 'I would rather give you a good product than a cheap problem.', zh: '我宁愿给您一个好产品，而不是一个便宜问题。', tip: '金句，客户会记住这句话。' }
        ]},
        { name: 'Day 6 · 建立节奏', items: [
          { id: 'a601', en: 'I will follow up every two weeks, unless you tell me otherwise.', zh: '我每两周跟进一次，除非您说不用。', tip: '主动定规则，客户不反感。' },
          { id: 'a602', en: 'Is there a better time to reach you?', zh: '哪个时间联系您比较方便？', tip: '尊重客户时区。' },
          { id: 'a603', en: 'Just keeping our conversation warm.', zh: '就当保持联系。', tip: '轻跟进的开场。' }
        ]},
        { name: 'Day 7 · 问清用途', items: [
          { id: 'a701', en: 'What will the mesh be used for, filtration or screening?', zh: '这网是用来过滤还是筛分？', tip: '用途决定选型。' },
          { id: 'a702', en: 'Do you need it coated or plain?', zh: '需要涂层还是本色？', tip: '' },
          { id: 'a703', en: 'Any specific standard, like ASTM or EN?', zh: '有指定标准吗，比如 ASTM 或 EN？', tip: '标准决定能不能做。' }
        ]},
        { name: 'Day 8 · 确认参数', items: [
          { id: 'a801', en: 'Please confirm: 100 mesh, 0.1 mm wire, 1 meter width.', zh: '请确认：100 目，0.1 丝径，1 米幅宽。', tip: '把参数念一遍，别偷懒。' },
          { id: 'a802', en: 'We can hold plus or minus 5 percent on the mesh count.', zh: '目数我们能做到正负 5%。', tip: '' },
          { id: 'a803', en: 'Would 30 meters per roll work for you?', zh: '每卷 30 米可以吗？', tip: '' }
        ]},
        { name: 'Day 9 · 打样确认', items: [
          { id: 'a901', en: 'We will make a pre-production sample for your approval.', zh: '我们会做一个产前样给您确认。', tip: '' },
          { id: 'a902', en: 'Please sign back the sample so we can start production.', zh: '请回签样品，我们就可以投产。', tip: '回签是保护自己。' },
          { id: 'a903', en: 'It takes about 5 days to prepare the sample.', zh: '打样大概需要 5 天。', tip: '' }
        ]},
        { name: 'Day 10 · 交期沟通', items: [
          { id: 'a1001', en: 'Our lead time is 20 to 25 days after deposit.', zh: '定金后交期 20 到 25 天。', tip: '说清起算点。' },
          { id: 'a1002', en: 'If you need it urgently, we can split the shipment.', zh: '如果急用，我们可以分批发货。', tip: '' },
          { id: 'a1003', en: 'I will keep you updated on the production schedule.', zh: '我会同步生产进度给您。', tip: '主动同步最能建立信任。' }
        ]},
        { name: 'Day 11 · 付款方式', items: [
          { id: 'a1101', en: 'Our usual terms are 30 percent deposit, 70 percent before shipment.', zh: '我们通常 30% 定金，70% 发货前付。', tip: '' },
          { id: 'a1102', en: 'We can accept an L/C at sight for larger orders.', zh: '大订单我们可以接受即期信用证。', tip: '' },
          { id: 'a1103', en: 'Let us put the terms in the PI so we are both clear.', zh: '我们把条款写进形式发票，双方都清楚。', tip: 'PI = proforma invoice 形式发票。' }
        ]},
        { name: 'Day 12 · 价格有效期', items: [
          { id: 'a1201', en: 'This quotation is valid for 15 days.', zh: '这份报价 15 天内有效。', tip: '' },
          { id: 'a1202', en: 'Steel prices have been moving a lot lately.', zh: '最近钢价波动很大。', tip: '解释为什么要设有效期。' },
          { id: 'a1203', en: 'If you confirm this week, I can lock the price.', zh: '如果这周确认，我可以锁价。', tip: '把不确定性变成行动理由。' }
        ]},
        { name: 'Day 13 · 报价结构', items: [
          { id: 'a1301', en: 'Our price is FOB Tianjin, including standard export packing.', zh: '我们的价格是天津港 FOB，含标准出口包装。', tip: '说清含什么，比说价格重要。' },
          { id: 'a1302', en: 'CIF would add about 300 dollars for one 20GP.', zh: 'CIF 的话，一个 20 尺柜加约 300 美元。', tip: '' },
          { id: 'a1303', en: 'The price excludes bank charges at your end.', zh: '价格不含贵方银行费用。', tip: '' }
        ]},
        { name: 'Day 14 · 客户说太贵', items: [
          { id: 'a1401', en: 'Compared with the market, our price is quite competitive.', zh: '跟市场比，我们的价格很有竞争力。', tip: '' },
          { id: 'a1402', en: 'The difference is the raw material grade.', zh: '差别在原材料等级。', tip: '把价格差异归因到看得见的地方。' },
          { id: 'a1403', en: 'Cheap mesh often means thinner wire than ordered.', zh: '便宜的网往往是丝径比定的细。', tip: '客观陈述，不贬低同行。' }
        ]},
        { name: 'Day 15 · 谈判让步', items: [
          { id: 'a1501', en: 'If you double the quantity, I can give you 3 percent off.', zh: '如果数量翻倍，我可以给您 3% 的折扣。', tip: '让步必须换东西。' },
          { id: 'a1502', en: 'I cannot move on price, but I can give you better packing.', zh: '价格动不了，但包装可以升级。', tip: '' },
          { id: 'a1503', en: 'Let us find a solution that works for both of us.', zh: '我们找个双方都能接受的方案。', tip: '' }
        ]},
        { name: 'Day 16 · 付款让步', items: [
          { id: 'a1601', en: 'I can accept 20 percent deposit for the first order.', zh: '首单我可以接受 20% 定金。', tip: '' },
          { id: 'a1602', en: 'We could do 50/50 if that helps your cash flow.', zh: '如果对您现金流有帮助，可以 50/50。', tip: '' },
          { id: 'a1603', en: 'This is a one-time flexibility for our first cooperation.', zh: '这是我们首次合作的特殊让步。', tip: '让步要标明是"一次性"。' }
        ]},
        { name: 'Day 17 · 促单', items: [
          { id: 'a1701', en: 'Should I reserve the production slot for you?', zh: '要我帮您预留产线档期吗？', tip: '' },
          { id: 'a1702', en: 'We have a container leaving on the 20th.', zh: '我们 20 号有一个柜要走。', tip: '真实的时间点最有说服力。' },
          { id: 'a1703', en: 'A quick confirmation would help us plan better.', zh: '早点确认对我们排产有帮助。', tip: '把催促翻译成"帮我个忙"。' }
        ]},
        { name: 'Day 18 · 确认订单', items: [
          { id: 'a1801', en: 'I am attaching the PI for your confirmation.', zh: '附上形式发票，请确认。', tip: '' },
          { id: 'a1802', en: 'Please check the bank details and sign back.', zh: '请核对银行信息并回签。', tip: '' },
          { id: 'a1803', en: 'Once the deposit arrives, we will start immediately.', zh: '定金到账我们立即开始。', tip: '' }
        ]},
        { name: 'Day 19 · 生产跟进', items: [
          { id: 'a1901', en: 'Your order is in production now.', zh: '您的订单正在生产中。', tip: '' },
          { id: 'a1902', en: 'Here are some photos from the production line.', zh: '这是产线上的照片。', tip: '每周一张照片，客户不会焦虑。' },
          { id: 'a1903', en: 'We are on schedule for the 25th.', zh: '我们按计划 25 号完成。', tip: '' }
        ]},
        { name: 'Day 20 · 验货', items: [
          { id: 'a2001', en: 'Would you like to arrange an inspection?', zh: '您要安排验货吗？', tip: '主动问，客户反而更信任你。' },
          { id: 'a2002', en: 'Our QC checks mesh count, wire diameter and width.', zh: '我们的质检检查目数、丝径和幅宽。', tip: '' },
          { id: 'a2003', en: 'Here is the inspection report for your reference.', zh: '这是检验报告，供您参考。', tip: '' }
        ]},
        { name: 'Day 21 · 包装', items: [
          { id: 'a2101', en: 'We pack in waterproof paper, then on wooden pallets.', zh: '我们用防水纸包装，再上木托。', tip: '' },
          { id: 'a2102', en: 'Do you need your logo printed on the rolls?', zh: '需要在卷上印您的 logo 吗？', tip: '' },
          { id: 'a2103', en: 'Each roll is labelled with the spec and roll number.', zh: '每卷都贴规格和卷号标签。', tip: '' }
        ]},
        { name: 'Day 22 · 订舱出运', items: [
          { id: 'a2201', en: 'We have booked the space for the 20GP.', zh: '20 尺柜已经订舱。', tip: '' },
          { id: 'a2202', en: 'The ETD is the 28th from Tianjin.', zh: '预计 28 号从天津发运。', tip: 'ETD = estimated time of departure。' },
          { id: 'a2203', en: 'I will send you the draft B/L to check.', zh: '我把提单草稿发您核对。', tip: '' }
        ]},
        { name: 'Day 23 · 单据', items: [
          { id: 'a2301', en: 'Please find the invoice, packing list and B/L attached.', zh: '附件是发票、装箱单和提单。', tip: '' },
          { id: 'a2302', en: 'Let me know if your customs need anything else.', zh: '如果贵方清关还需要别的资料，告诉我。', tip: '' },
          { id: 'a2303', en: 'We can issue a Form A or CO if required.', zh: '需要的话我们可以出 FORM A 或产地证。', tip: 'CO = certificate of origin。' }
        ]},
        { name: 'Day 24 · 到港提醒', items: [
          { id: 'a2401', en: 'The vessel is expected to arrive around the 15th.', zh: '船预计 15 号左右到港。', tip: '' },
          { id: 'a2402', en: 'Please arrange the balance payment before arrival.', zh: '请在到港前安排余款。', tip: '把催款包在物流信息里，不突兀。' },
          { id: 'a2403', en: 'Let me know once you receive the goods.', zh: '收到货告诉我一声。', tip: '' }
        ]},
        { name: 'Day 25 · 收货确认', items: [
          { id: 'a2501', en: 'Glad to hear the goods arrived safely.', zh: '很高兴货安全到达。', tip: '' },
          { id: 'a2502', en: 'How does the quality look compared with the sample?', zh: '质量跟样品比怎么样？', tip: '主动问质量，比等投诉好。' },
          { id: 'a2503', en: 'Any feedback would be very helpful for us.', zh: '任何反馈对我们都很有帮助。', tip: '' }
        ]},
        { name: 'Day 26 · 处理问题', items: [
          { id: 'a2601', en: 'I am sorry to hear about the issue with the mesh count.', zh: '很抱歉听说目数有问题。', tip: '' },
          { id: 'a2602', en: 'Could you send photos and the inspection record?', zh: '能发照片和检验记录吗？', tip: '' },
          { id: 'a2603', en: 'We will give you credit in the next order.', zh: '我们在下个订单里给您抵扣。', tip: '' }
        ]},
        { name: 'Day 27 · 复购铺垫', items: [
          { id: 'a2701', en: 'Are you planning your next order?', zh: '您在计划下一单吗？', tip: '' },
          { id: 'a2702', en: 'I can reserve the same price for your repeat order.', zh: '复购我可以保留同样的价格。', tip: '' },
          { id: 'a2703', en: 'Would you like to try another spec this time?', zh: '这次要不要试个别的规格？', tip: '推新品最好的时机是复购。' }
        ]},
        { name: 'Day 28 · 转介绍', items: [
          { id: 'a2801', en: 'If you know anyone who needs wire mesh, I would appreciate an introduction.', zh: '如果您认识需要丝网的人，帮忙引荐一下。', tip: '' },
          { id: 'a2802', en: 'We also supply welded panels and gabions.', zh: '我们也供应焊接网片和石笼网。', tip: '' },
          { id: 'a2803', en: 'Happy to quote for any new inquiry.', zh: '有新询盘随时报价。', tip: '' }
        ]},
        { name: 'Day 29 · 长期合作', items: [
          { id: 'a2901', en: 'We would like to be your long-term supplier in China.', zh: '我们希望成为您在中国的长期供应商。', tip: '' },
          { id: 'a2902', en: 'Our goal is to make your sourcing easier.', zh: '我们的目标是让您采购更省心。', tip: '' },
          { id: 'a2903', en: 'Let us set a yearly plan together.', zh: '我们一起定个年度计划吧。', tip: '' }
        ]},
        { name: 'Day 30 · 收尾维护', items: [
          { id: 'a3001', en: 'Thanks for a great first cooperation.', zh: '感谢首次合作愉快。', tip: '' },
          { id: 'a3002', en: 'I will check in at the start of every month.', zh: '我每月初会跟您联系一次。', tip: '' },
          { id: 'a3003', en: 'Wishing you a smooth selling season.', zh: '祝您销售顺利。', tip: '' }
        ]}
      ]
    },

    /* ================= 5. 30 天丝网成交话术实战 ================= */
    planB: {
      id: 'planB',
      title: '30 天丝网成交话术实战',
      tag: '30 天主线',
      type: 'sentence',
      desc: '每天 1 个成交场景，一句话直接复制发给客户。专门处理价格异议、催款、交期、样品这些卡单的地方。',
      units: [
        { name: 'Day 1 · 客户说太贵', items: [{ id: 'b101', en: 'I hear you. Let us look at the spec instead of the price — a small change can make a big difference.', zh: '我明白。我们先看规格而不是价格——一个小调整就能差很多。', tip: '' }]},
        { name: 'Day 2 · 客户拿别家低价压你', items: [{ id: 'b201', en: 'May I see their spec sheet? If it is the same spec, I will look at my price again honestly.', zh: '能看下他们的规格单吗？如果规格一样，我认真再看一遍我的价格。', tip: '把比价拉回比规格。' }]},
        { name: 'Day 3 · 要求先降价再谈量', items: [{ id: 'b301', en: 'I can talk about price once we have a quantity. Give me a number and I will work on it.', zh: '有了数量我才能谈价格。给我个数，我来想办法。', tip: '' }]},
        { name: 'Day 4 · 客户说你们比去年贵', items: [{ id: 'b401', en: 'You are right, and I would rather explain than hide it — steel went up twice this year.', zh: '您说得对，我宁愿解释也不瞒您——今年钢价涨了两次。', tip: '' }]},
        { name: 'Day 5 · 客户要 30 天账期', items: [{ id: 'b501', en: 'For the first order, 30 percent deposit works better for us. From the second order, we can be more flexible.', zh: '首单 30% 定金对我们更稳。从第二单开始，我们可以更灵活。', tip: '' }]},
        { name: 'Day 6 · 客户迟迟不确认', items: [{ id: 'b601', en: 'Should I hold the price for you until Friday? After that I cannot promise.', zh: '要帮您把价格保留到周五吗？之后我就不敢保证了。', tip: '' }]},
        { name: 'Day 7 · 客户说再考虑一下', items: [{ id: 'b701', en: 'Of course. Is there anything unclear I can help with before you decide?', zh: '当然。在您决定之前，有什么不清楚的我可以帮您理一下吗？', tip: '把"再考虑"翻译成"还有疑问"。' }]},
        { name: 'Day 8 · 客户要免费样品还包运费', items: [{ id: 'b801', en: 'The sample is free — you only cover the courier. It is about 40 dollars to Europe.', zh: '样品免费，您只需承担快递费，到欧洲大概 40 美元。', tip: '给具体数字，客户好判断。' }]},
        { name: 'Day 9 · 客户要很多样品', items: [{ id: 'b901', en: 'I can send one or two sizes for free. For more, let us share the cost, or you can place a small trial order.', zh: '我可以免费寄一两个规格。再多的话我们分担成本，或者您下个小试单。', tip: '' }]},
        { name: 'Day 10 · 客户要看工厂', items: [{ id: 'b1001', en: 'You are welcome any time. If it is hard to travel, we can do a video tour of the workshop.', zh: '随时欢迎。如果不方便来，我们可以视频带您看车间。', tip: '视频验厂是很强的信任工具。' }]},
        { name: 'Day 11 · 压价到成本以下', items: [{ id: 'b1101', en: 'That is below our cost. I would rather tell you now than deliver something that fails your QC.', zh: '这个价低于我们成本。我宁愿现在告诉您，也不想交一批过不了您质检的货。', tip: '' }]},
        { name: 'Day 12 · 客户问最低价', items: [{ id: 'b1201', en: 'Give me your target quantity and I will give you my best number, not a rounded one.', zh: '告诉我您的目标数量，我给您最实在的价，不是随便报一个。', tip: '' }]},
        { name: 'Day 13 · 客户想跳过定金', items: [{ id: 'b1301', en: 'No deposit means no production slot. That rule protects both of us.', zh: '没有定金就没有产线档期，这规矩是保护双方的。', tip: '' }]},
        { name: 'Day 14 · 改规格不想改价', items: [{ id: 'b1401', en: 'Changing the spec changes the cost. Let me show you the numbers so it is clear.', zh: '改规格就是改成本。我把数字摊开给您看，就清楚了。', tip: '' }]},
        { name: 'Day 15 · 客户问能不能更快', items: [{ id: 'b1501', en: 'Standard is 20 days. If you need it in 12, we can rush it — there is a small extra charge.', zh: '常规 20 天。如果 12 天要，我们可以赶工，有一点加急费。', tip: '' }]},
        { name: 'Day 16 · 客户抱怨交期晚了', items: [{ id: 'b1601', en: 'That one was on us. This time I will send you weekly production photos so you are not guessing.', zh: '上次是我们的问题。这次我每周给您发生产照片，不让您猜。', tip: '认账 + 给机制，才算真解决。' }]},
        { name: 'Day 17 · 客户要跟老板汇报', items: [{ id: 'b1701', en: 'I will send you a one-page summary you can forward — spec, price, lead time, payment.', zh: '我发您一页纸的汇总，您直接转给老板就行——规格、价格、交期、付款。', tip: '帮客户省事，就是帮自己成单。' }]},
        { name: 'Day 18 · 客户在比价', items: [{ id: 'b1801', en: 'Compare all of us. Just make sure the specs match — that is where the real difference shows.', zh: '都对比一下。只要确认规格一致——差别就藏在那儿。', tip: '' }]},
        { name: 'Day 19 · 我们做不了', items: [{ id: 'b1901', en: 'We cannot do everything, but I will tell you honestly instead of taking the order and failing.', zh: '我们不是什么都做，但我会如实告诉您，而不是先接单再搞砸。', tip: '' }]},
        { name: 'Day 20 · 客户要 OEM', items: [{ id: 'b2001', en: 'No problem — we print your logo on the roll and the labels. It is free above 200 rolls.', zh: '没问题，卷上和标签都可以印您的 logo，200 卷以上免费。', tip: '' }]},
        { name: 'Day 21 · 客户要见提单副本付款', items: [{ id: 'b2101', en: 'We can do balance against the B/L copy for repeat customers. For the first order, before shipment.', zh: '老客户可以见提单副本付余款。首单还是发货前付。', tip: '用条件换条件。' }]},
        { name: 'Day 22 · 客户质疑质量', items: [{ id: 'b2201', en: 'Send me your test result and I will check it against our inspection report. Two sets of data, one answer.', zh: '把您的检测结果发我，我跟我们的检验报告对一下。两份数据，一个结论。', tip: '' }]},
        { name: 'Day 23 · 包装坏了', items: [{ id: 'b2301', en: 'Send me photos of the pallet and the label. We will find out where it went wrong and fix it.', zh: '拍下木托和标签的照片发我。我们查清哪一环出问题，然后解决。', tip: '' }]},
        { name: 'Day 24 · 客户要退款', items: [{ id: 'b2401', en: 'Let us solve the problem first — replacement, credit or refund. I will not leave you holding it.', zh: '我们先把问题解决——补货、抵扣还是退款。我不会让您一个人扛。', tip: '' }]},
        { name: 'Day 25 · 余款迟迟不打', items: [{ id: 'b2501', en: 'The goods are ready and the vessel sails on the 28th. Without the balance we would have to roll it.', zh: '货好了，船 28 号开。余款不到，我们只能延一水。', tip: '把后果摆出来，不威胁。' }]},
        { name: 'Day 26 · 客户说不降价就走', items: [{ id: 'b2601', en: 'I would hate to lose you over price. Tell me your best number and I will tell you honestly if it works.', zh: '我不想因为价格失去您。说个您能给的数，我如实告诉您行不行。', tip: '' }]},
        { name: 'Day 27 · 推动第二单', items: [{ id: 'b2701', en: 'Your first container sold well? Let us plan the second one before the price moves again.', zh: '第一柜卖得不错吧？趁价格再动之前，我们把第二柜定下来。', tip: '' }]},
        { name: 'Day 28 · 客户引荐同行', items: [{ id: 'b2801', en: 'Thanks for the introduction. I will take good care of them and keep you posted.', zh: '谢谢引荐。我会好好服务，也会同步进展给您。', tip: '' }]},
        { name: 'Day 29 · 市场差要减量', items: [{ id: 'b2901', en: 'Let us keep the volume and split the shipment instead — you pay as it sells.', zh: '量别减，我们改分批发货吧——您卖一批付一批。', tip: '' }]},
        { name: 'Day 30 · 长期合作收尾', items: [{ id: 'b3001', en: 'I am not chasing one order. I want to be the supplier you do not have to worry about.', zh: '我不是冲一单来的。我想做那个您不用操心的供应商。', tip: '收尾金句。' }]}
      ]
    }

  }
};

/* 便捷方法：统计某课程的句子总数 */
window.SW_COUNT = function (courseId) {
  var c = window.SW_COURSES.list[courseId];
  if (!c) return 0;
  var n = 0;
  for (var i = 0; i < c.units.length; i++) n += c.units[i].items.length;
  return n;
};
