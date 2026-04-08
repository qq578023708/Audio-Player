declare module 'crypto-js' {
  export = CryptoJS
  export as namespace CryptoJS

  namespace lib {
    interface WordArray {
      words: number[]
      sigBytes: number
    }
    var WordArray: {
      create(words?: number[], sigBytes?: number): WordArray
    }
    interface IBlockCipherCfgOptions {
      mode?: any
      padding?: any
      iv?: string
    }
  }
  namespace mode {
    const ECB: any
    const CBC: any
  }
  namespace pad {
    const Pkcs7: any
  }
  namespace enc {
    const Utf8: {
      parse(str: string): any
    }
    const Hex: any
    const Base64: any
  }
  namespace AES {
    function encrypt(data: string, key: string, cfg?: lib.IBlockCipherCfgOptions): any
  }

  function MD5(str: string): any

  const CryptoJS: any
}
