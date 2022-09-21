declare interface GachaLogData {
  id: string
  gachaType: string
  time: string
  name: string
  itemType: "キャラクター" | "武器"
  rankType: string
}

declare interface ShowcaseCharacter {
  characterId: string
  characterName: string
  level: number
  ascension: number
  talentLevels: {
    normal: number
    skill: number
    burst: number
  }
}

declare interface AvatarInfo {
  uid: string
  ttl: number
  username: string
  adventureRank: number
  showcaseCharacters: ShowcaseCharacter[]
}

interface PropMap {
  type: number
  val: string
}

declare interface EnkaNetworkResponse {
  uid: string
  ttl: number
  playerInfo: {
    nickname: string
    level: number
    showAvatarInfoList: {
      avatarId: string
      level: number
    }[]
  }
  avatarInfoList: {
    propMap: {[id: string]: PropMap}
    skillLevelMap: {[id: string]: number}
    skillDepotId: number
  }[]
}

declare interface ErrorResponse {
  errorMessage: string
}
