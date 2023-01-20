import { Config } from './config.js'
import { Message } from 'wechaty'
import { ContactInterface, RoomInterface } from 'wechaty/impls'
import { Configuration, OpenAIApi } from 'openai'

// ChatGPT error response configuration
const chatgptErrorMessage = '🤖️：AI机器人摆烂了，请稍后再试～'

// ChatGPT model configuration
// please refer to the OpenAI API doc: https://beta.openai.com/docs/api-reference/introduction
const ChatGPTModelConfig = {
  // this model field is required
  model: 'text-davinci-003',
  // add your ChatGPT model parameters below
  temperature: 0.3,
  max_tokens: 2000,
}

// message size for a single reply by the bot
const SINGLE_MESSAGE_MAX_SIZE = 500

enum MessageType {
  Unknown = 0,
  Attachment = 1, // Attach(6),
  Audio = 2, // Audio(1), Voice(34)
  Contact = 3, // ShareCard(42)
  ChatHistory = 4, // ChatHistory(19)
  Emoticon = 5, // Sticker: Emoticon(15), Emoticon(47)
  Image = 6, // Img(2), Image(3)
  Text = 7, // Text(1)
  Location = 8, // Location(48)
  MiniProgram = 9, // MiniProgram(33)
  GroupNote = 10, // GroupNote(53)
  Transfer = 11, // Transfers(2000)
  RedEnvelope = 12, // RedEnvelopes(2001)
  Recalled = 13, // Recalled(10002)
  Url = 14, // Url(5)
  Video = 15, // Video(4), Video(43)
  Post = 16, // Moment, Channel, Tweet, etc
}

export class ChatGPTBot {
  botName: string = ''
  chatgptTriggerKeyword = Config.chatgptTriggerKeyword
  OpenAIConfig: any // OpenAI API key
  OpenAI: any // OpenAI API instance

  // Chatgpt fine-tune for being a chatbot (guided by OpenAI official document)
  applyContext(text: string): string {
    return `You are an artificial intelligence bot from a company called "OpenAI". Your primary tasks are chatting with users and answering their questions.\nIf the user says: ${text}.\nYou will say: `
  }

  setBotName(botName: string) {
    this.botName = botName
  }

  // get trigger keyword in group chat: (@Name <keyword>)
  get chatGroupTriggerKeyword(): string {
    return `@${this.botName} ${this.chatgptTriggerKeyword || ''}`
  }

  // configure API with model API keys and run an initial test
  async startGPTBot() {
    try {
      // OpenAI Account configuration
      this.OpenAIConfig = new Configuration({
        organization: Config.openaiOrganizationID,
        apiKey: Config.openaiApiKey,
      })
      // OpenAI API instance
      this.OpenAI = new OpenAIApi(this.OpenAIConfig)
      // Hint user the trigger keyword in private chat and group chat
      console.log(`🤖️ Chatbot name is: ${this.botName}`)
      console.log(
        `🎯 Trigger keyword in private chat is: ${this.chatgptTriggerKeyword}`
      )
      console.log(
        `🎯 Trigger keyword in group chat is: ${this.chatGroupTriggerKeyword}`
      )
      // Run an initial test to confirm API works fine
      await this.onChatGPT('Say Hello World')
      console.log(`✅ Chatbot starts success, ready to handle message!`)
    } catch (e) {
      console.error(`❌ ${e}`)
    }
  }

  // get clean message by removing reply separater and group mention characters
  cleanMessage(rawText: string, isPrivateChat: boolean = false): string {
    let text = rawText
    const item = rawText.split('- - - - - - - - - - - - - - -')
    if (item.length > 1) {
      text = item[item.length - 1]
    }
    text = text.replace(
      isPrivateChat ? this.chatgptTriggerKeyword : this.chatGroupTriggerKeyword,
      ''
    )
    return text
  }

  // check whether ChatGPT bot can be triggered
  triggerGPTMessage(text: string, isPrivateChat: boolean = false): boolean {
    const chatgptTriggerKeyword = this.chatgptTriggerKeyword
    let triggered = false
    if (isPrivateChat) {
      triggered = chatgptTriggerKeyword
        ? text.startsWith(chatgptTriggerKeyword)
        : true
    } else {
      triggered = text.startsWith(this.chatGroupTriggerKeyword)
    }
    if (triggered) {
      console.log(`🎯 Chatbot triggered: ${text}`)
    }
    return triggered
  }

  // filter out the message that does not need to be processed
  isNonsense(
    talker: ContactInterface,
    messageType: MessageType,
    text: string
  ): boolean {
    return (
      // self-chatting can be used for testing
      talker.self() ||
      messageType > MessageType.GroupNote ||
      talker.name() == '微信团队' ||
      // video or voice reminder
      text.includes('收到一条视频/语音聊天消息，请在手机上查看') ||
      // red pocket reminder
      text.includes('收到红包，请在手机上查看') ||
      // location information
      text.includes('/cgi-bin/mmwebwx-bin/webwxgetpubliclinkimg')
    )
  }

  // send question to ChatGPT with OpenAI API and get answer
  async onChatGPT(text: string): Promise<string> {
    const inputMessage = this.applyContext(text)
    const time = new Date()
    const year = time.getFullYear()
    const month = time.getMonth() + 1 //月份从0开始
    const day = time.getDate()
    const week = time.getDay()
    const weekList = [
      '星期天',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六',
    ]
    const weekName = weekList[week]
    const formatTime = `${year}年${month}月${day}日${weekName}`
    const badwords = [
      '辱华',
      '人矿',
      '乌鲁木齐中路',
      '白纸运动',
      '独裁',
      '朝鲜',
      '中国',
      '习近平',
      '美国',
      '民主',
      '自由',
      '李克强',
      'badwords',
    ]
    const cities = [
      '北京市',
      '天津市',
      '石家庄市',
      '唐山市',
      '秦皇岛市',
      '邯郸市',
      '邢台市',
      '保定市',
      '张家口市',
      '承德市',
      '沧州市',
      '廊坊市',
      '衡水市',
      '省直辖县',
      '太原市',
      '大同市',
      '阳泉市',
      '长治市',
      '晋城市',
      '朔州市',
      '晋中市',
      '运城市',
      '忻州市',
      '临汾市',
      '吕梁市',
      '呼和浩特市',
      '包头市',
      '乌海市',
      '赤峰市',
      '通辽市',
      '鄂尔多斯市',
      '呼伦贝尔市',
      '巴彦淖尔市',
      '乌兰察布市',
      '兴安盟',
      '锡林郭勒盟',
      '阿拉善盟',
      '沈阳市',
      '大连市',
      '鞍山市',
      '抚顺市',
      '本溪市',
      '丹东市',
      '锦州市',
      '营口市',
      '阜新市',
      '辽阳市',
      '盘锦市',
      '铁岭市',
      '朝阳市',
      '葫芦岛市',
      '长春市',
      '吉林市',
      '四平市',
      '辽源市',
      '通化市',
      '白山市',
      '松原市',
      '白城市',
      '延边朝鲜族自治州',
      '哈尔滨市',
      '齐齐哈尔市',
      '鸡西市',
      '鹤岗市',
      '双鸭山市',
      '大庆市',
      '伊春市',
      '佳木斯市',
      '七台河市',
      '牡丹江市',
      '黑河市',
      '绥化市',
      '大兴安岭地区',
      '上海市',
      '南京市',
      '无锡市',
      '徐州市',
      '常州市',
      '苏州市',
      '南通市',
      '连云港市',
      '淮安市',
      '盐城市',
      '扬州市',
      '镇江市',
      '泰州市',
      '宿迁市',
      '杭州市',
      '宁波市',
      '温州市',
      '嘉兴市',
      '湖州市',
      '绍兴市',
      '金华市',
      '衢州市',
      '舟山市',
      '台州市',
      '丽水市',
      '合肥市',
      '芜湖市',
      '蚌埠市',
      '淮南市',
      '马鞍山市',
      '淮北市',
      '铜陵市',
      '安庆市',
      '黄山市',
      '滁州市',
      '阜阳市',
      '宿州市',
      '六安市',
      '亳州市',
      '池州市',
      '宣城市',
      '福州市',
      '厦门市',
      '莆田市',
      '三明市',
      '泉州市',
      '漳州市',
      '南平市',
      '龙岩市',
      '宁德市',
      '南昌市',
      '景德镇市',
      '萍乡市',
      '九江市',
      '新余市',
      '鹰潭市',
      '赣州市',
      '吉安市',
      '宜春市',
      '抚州市',
      '上饶市',
      '济南市',
      '青岛市',
      '淄博市',
      '枣庄市',
      '东营市',
      '烟台市',
      '潍坊市',
      '济宁市',
      '泰安市',
      '威海市',
      '日照市',
      '莱芜市',
      '临沂市',
      '德州市',
      '聊城市',
      '滨州市',
      '菏泽市',
      '郑州市',
      '开封市',
      '洛阳市',
      '平顶山市',
      '安阳市',
      '鹤壁市',
      '新乡市',
      '焦作市',
      '濮阳市',
      '许昌市',
      '漯河市',
      '三门峡市',
      '南阳市',
      '商丘市',
      '信阳市',
      '周口市',
      '驻马店市',
      '省直辖县',
      '武汉市',
      '黄石市',
      '十堰市',
      '宜昌市',
      '襄阳市',
      '鄂州市',
      '荆门市',
      '孝感市',
      '荆州市',
      '黄冈市',
      '咸宁市',
      '随州市',
      '恩施土家族苗族自治州',
      '省直辖县',
      '长沙市',
      '株洲市',
      '湘潭市',
      '衡阳市',
      '邵阳市',
      '岳阳市',
      '常德市',
      '张家界市',
      '益阳市',
      '郴州市',
      '永州市',
      '怀化市',
      '娄底市',
      '湘西土家族苗族自治州',
      '广州市',
      '韶关市',
      '深圳市',
      '珠海市',
      '汕头市',
      '佛山市',
      '江门市',
      '湛江市',
      '茂名市',
      '肇庆市',
      '惠州市',
      '梅州市',
      '汕尾市',
      '河源市',
      '阳江市',
      '清远市',
      '东莞市',
      '中山市',
      '潮州市',
      '揭阳市',
      '云浮市',
      '南宁市',
      '柳州市',
      '桂林市',
      '梧州市',
      '北海市',
      '防城港市',
      '钦州市',
      '贵港市',
      '玉林市',
      '百色市',
      '贺州市',
      '河池市',
      '来宾市',
      '崇左市',
      '海口市',
      '三亚市',
      '三沙市',
      '儋州市',
      '省直辖县',
      '重庆市',
      '成都市',
      '自贡市',
      '攀枝花市',
      '泸州市',
      '德阳市',
      '绵阳市',
      '广元市',
      '遂宁市',
      '内江市',
      '乐山市',
      '南充市',
      '眉山市',
      '宜宾市',
      '广安市',
      '达州市',
      '雅安市',
      '巴中市',
      '资阳市',
      '阿坝藏族羌族自治州',
      '甘孜藏族自治州',
      '凉山彝族自治州',
      '贵阳市',
      '六盘水市',
      '遵义市',
      '安顺市',
      '毕节市',
      '铜仁市',
      '黔西南布依族苗族自治州',
      '黔东南苗族侗族自治州',
      '黔南布依族苗族自治州',
      '昆明市',
      '曲靖市',
      '玉溪市',
      '保山市',
      '昭通市',
      '丽江市',
      '普洱市',
      '临沧市',
      '楚雄彝族自治州',
      '红河哈尼族彝族自治州',
      '文山壮族苗族自治州',
      '西双版纳傣族自治州',
      '大理白族自治州',
      '德宏傣族景颇族自治州',
      '怒江傈僳族自治州',
      '迪庆藏族自治州',
      '拉萨市',
      '日喀则市',
      '昌都市',
      '林芝市',
      '山南市',
      '那曲市',
      '阿里地区',
      '西安市',
      '铜川市',
      '宝鸡市',
      '咸阳市',
      '渭南市',
      '延安市',
      '汉中市',
      '榆林市',
      '安康市',
      '商洛市',
      '兰州市',
      '嘉峪关市',
      '金昌市',
      '白银市',
      '天水市',
      '武威市',
      '张掖市',
      '平凉市',
      '酒泉市',
      '庆阳市',
      '定西市',
      '陇南市',
      '临夏回族自治州',
      '甘南藏族自治州',
      '西宁市',
      '海东市',
      '海北藏族自治州',
      '黄南藏族自治州',
      '海南藏族自治州',
      '果洛藏族自治州',
      '玉树藏族自治州',
      '海西蒙古族藏族自治州',
      '银川市',
      '石嘴山市',
      '吴忠市',
      '固原市',
      '中卫市',
      '乌鲁木齐市',
      '克拉玛依市',
      '吐鲁番市',
      '哈密市',
      '昌吉回族自治州',
      '博尔塔拉蒙古自治州',
      '巴音郭楞蒙古自治州',
      '阿克苏地区',
      '克孜勒苏柯尔克孜自治州',
      '喀什地区',
      '和田地区',
      '伊犁哈萨克自治州',
      '塔城地区',
      '阿勒泰地区',
      '自治区直辖县级行政区划',
      '台北市',
      '高雄市',
      '台南市',
      '台中市',
      '金门县',
      '南投县',
      '基隆市',
      '新竹市',
      '嘉义市',
      '新北市',
      '宜兰县',
      '新竹县',
      '桃园县',
      '苗栗县',
      '彰化县',
      '嘉义县',
      '云林县',
      '屏东县',
      '台东县',
      '花莲县',
      '澎湖县',
      '连江县',
      '香港岛',
      '九龙',
      '新界',
      '澳门半岛',
      '离岛']
    try {
      // config OpenAI API request body

      const response = await this.OpenAI.createCompletion({
        ...ChatGPTModelConfig,
        prompt: inputMessage,
      })
      // use OpenAI API to get ChatGPT reply message
      if (inputMessage == '时间') {
        return formatTime
      }
      if (badwords.some((word) => inputMessage.includes(word))) {
        return '这是碰都不能碰的话题!'
      }
      if (inputMessage.includes("天气")) {
        const city = cities.find(city => inputMessage.includes(city));
        if (city) {
            fetch(`https://www.tianqiapi.com/free/day?appid=56761788&appsecret=ti3hP8y9&city=${city}`)
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    // 在这里处理获取到的天气信息
                    return data
                })
                .catch(error => {
                    console.error(error);
                });
        } else {
            console.log("找不到城市");
            return '找不到城市(待添加)'
        }
    }

      const chatgptReplyMessage = response?.data?.choices[0]?.text?.trim()
      console.log('🤖️ Chatbot says: ', chatgptReplyMessage)
      return chatgptReplyMessage
    } catch (e: any) {
      const errorResponse = e?.response
      const errorCode = errorResponse?.status
      const errorStatus = errorResponse?.statusText
      const errorMessage = errorResponse?.data?.error?.message
      console.error(`❌ Code ${errorCode}: ${errorStatus}`)
      console.error(`❌ ${errorMessage}`)
      return chatgptErrorMessage
    }
  }

  // reply with the segmented messages from a single-long message
  async reply(
    talker: RoomInterface | ContactInterface,
    mesasge: string
  ): Promise<void> {
    const messages: Array<string> = []
    let message = mesasge
    while (message.length > SINGLE_MESSAGE_MAX_SIZE) {
      messages.push(message.slice(0, SINGLE_MESSAGE_MAX_SIZE))
      message = message.slice(SINGLE_MESSAGE_MAX_SIZE)
    }
    messages.push(message)
    for (const msg of messages) {
      await talker.say(msg)
    }
  }

  // reply to private message
  async onPrivateMessage(talker: ContactInterface, text: string) {
    // get reply from ChatGPT
    const chatgptReplyMessage = await this.onChatGPT(text)
    // send the ChatGPT reply to chat
    await this.reply(talker, chatgptReplyMessage)
  }

  // reply to group message
  async onGroupMessage(room: RoomInterface, text: string) {
    // get reply from ChatGPT
    const chatgptReplyMessage = await this.onChatGPT(text)
    // the reply consist of: original text and bot reply
    const result = `${text}\n ---------- \n ${chatgptReplyMessage}`
    await this.reply(room, result)
  }

  // receive a message (main entry)
  async onMessage(message: Message) {
    const talker = message.talker()
    const rawText = message.text()
    const room = message.room()
    const messageType = message.type()
    const isPrivateChat = !room
    // do nothing if the message:
    //    1. is irrelevant (e.g. voice, video, location...), or
    //    2. doesn't trigger bot (e.g. wrong trigger-word)
    if (
      this.isNonsense(talker, messageType, rawText) ||
      !this.triggerGPTMessage(rawText, isPrivateChat)
    ) {
      return
    }
    // clean the message for ChatGPT input
    const text = this.cleanMessage(rawText, isPrivateChat)
    // reply to private or group chat
    if (isPrivateChat) {
      return await this.onPrivateMessage(talker, text)
    } else {
      return await this.onGroupMessage(room, text)
    }
  }
}
