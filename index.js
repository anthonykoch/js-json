
// Start 4:30

const S_SPACE = '[\u0009\u000a\u000d\u0020]'
const S_DIGIT = '[0-9]'
const S_DIGITS = '[0-9]+'
const S_ONENINE = '[1-9]'
const S_INT = `-?(?:(?:${S_ONENINE}${S_DIGITS})|${S_DIGIT})`
const S_FRAC = `(?:\\.${S_DIGITS})`
const S_EXP = `(?:[eE][+-]${S_DIGITS})`

const S_ESCAPE = `(?:[\\\\"bfnrt\\n\\r]|u[0-9a-fA-F]{4})`

const S_CHAR = `(?:\\\\${S_ESCAPE}|[^\\u0000-\\u001fb"\\\\\\r\\n])`

const S_STRING = `"${S_CHAR}*"`
const S_PUNC = '[":,\\[\\]\\{\\}]'
const S_BOOL = '(?:true|false)'
const S_NUMBER = `(?:${S_FRAC}${S_EXP}?|${S_INT}${S_FRAC}?${S_EXP}?)`
const S_NULL = 'null'

class Token {
  constructor(type, value, start) {
    this.type = type
    this.value = value
    this.start = start
    this.end = start + value.length
  }
}

const TOKEN_STRING = 'string'
const TOKEN_PUNCTUATOR = 'punctuator'
const TOKEN_NUMBER = 'number'
const TOKEN_BOOLEAN = 'boolean'
const TOKEN_NULL = 'null'

const grammar = [
  {
    type: TOKEN_STRING,
    regex: new RegExp(`^(?:${S_STRING})`,'u'),
  },
  {
    type: TOKEN_NUMBER,
    regex: new RegExp(`^(?:${S_NUMBER})`),
  },
  {
    type: TOKEN_PUNCTUATOR,
    regex: new RegExp(`^(?:${S_PUNC})`),
  },
  {
    type: TOKEN_BOOLEAN,
    regex: new RegExp(`^(?:${S_BOOL})`),
  },
  {
    type: TOKEN_NULL,
    regex: new RegExp(`^(?:${S_NULL})`),
  },
]

class Lexer {
  constructor(input) {
    this.index = 0
    this.source = input
    this.input = input
    this.stash = []
  }
  
  peek() {
    return this.lookahead(0)
  }
  
  lookahead(index) {
    if (index < 0) {
      throw new Error('Lookahead index can not be less than 0')
    }
    
    let times = index

    while (times-- > -1) {
      if (this.hasEnded()) {
        break
      }
      
      const token = this.lex()

      this.stash.push(token)
    }

    if (index < this.stash.length) {
      return this.stash[index]
    }

    return null
  }

  hasEnded() {
    return this.index >= this.source.length
  }

  next() {
    let token = null

    if (this.stash.length > 0) {
      token = this.stash.shift()
    } else if (this.hasEnded()) {
      return {
        done: true,
        value: undefined
      }
    } else {
      token = this.lex()
    }
    
    return { 
      done: false, 
      value: token,
    }
  }
  
  forward(times) {
    const start = this.index
    const newStart = Math.max(0, start + times)

    this.index += times
    this.input = this.source.substr(newStart)
  }
  
  skipWhitespace() {
    const start = this.index
    let i = this.index
    
    for (; i < this.source.length; i++) {
      const char = this.source.charCodeAt(i)

      if (char === 13) {
        // \r\n is technically considered one character
        if (this.source.charCodeAt(i + 1) === 10) {
          i += 1
        }
      } else if (char >= 0 && char <= 32) {
        continue
      } else {
        break
      }
    }

    this.forward(i - start)
  }
  
  lex() {
    this.skipWhitespace()

    for (const { regex, type } of grammar) {
      const match = this.input.match(regex)

      if (match != null) {
        const token = new Token(type, match[0], this.index)

        this.forward(token.value.length)
        this.skipWhitespace()
        
        return token;
      }
    }

    throw new Error(`Unexpected token '${this.source[this.index]}'`)
  }

  [Symbol.iterator]() {
    return this
  }
}

Lexer.all = (input) => {
  const tokens = []
  const lexer = new Lexer(input)

  for (const token of lexer) {
    tokens.push(token)
  }

  return tokens
}

class Parser {
  constructor(input) {
    this.source = input
    this.lexer = new Lexer(input)
  }

  error(message) {
    throw new Error(message)
  }

  ensure() {
    const token = this.lexer.next().value
    let found = false

    for (let i = 0; i < arguments.length; i++) {
      if (token != null && token.value === arguments[i]) {
        found = true
      }
    }

    if (found === false) {
      this.error(`Expected '${arguments}', got '${token.value}'`)
    }

    return token
  }

  ensureType() {
    const token = this.lexer.next().value
    let found = false

    for (let i = 0; i < arguments.length; i++) {
      if (token != null && token.type === arguments[i]) {
        found = true
      }
    }

    if (found === false) {
      this.error(`Token value '${token.value}' does not match value '${value}'`)
    }

    return token
  }

  is(value) {
    return this.lexer.peek().value === value
  } 
  
  parseValue() {
    const token = this.lexer.peek()

    if (token == null) {
      this.error(`Unexpected end of input`)
    }
    
    if (this.is('{')) {
      return this.parseObjectLiteral()
    } else if (this.is('[')) {
      return this.parseArrayLiteral()
    } else {
      let node = null

      if (token.type === TOKEN_BOOLEAN) {
        node = new BooleanLiteral(token.value, token.start, token.end)
      } else if (token.type === TOKEN_STRING) {
        node = new StringLiteral(token.value, token.start, token.end)
      } else if (token.type === TOKEN_NUMBER) {
        node = new NumericLiteral(token.value, token.start, token.end)
      } else if (token.type === TOKEN_NULL) {
        node = new NullLiteral(token.start)
      }

      if (node != null) {
        this.lexer.next()
        return node
      }
    }

    this.error(`Unexpected token ${token.value}`)
  }

  parseObjectLiteral() {
    const properties = []

    const startToken = this.ensure('{')

    while (!this.is('}')) {
      const key = this.ensureType(TOKEN_STRING, TOKEN_NUMBER)

      this.ensure(':')

      const value = this.parseValue()

      properties.push(new Property(key, value, key.start, value.end))

      if (!this.is('}')) {
        this.ensure(',')
      }
    }
    
    const endToken = this.ensure('}')

    return new ObjectLiteral(properties, startToken.start, endToken.end)
  }

  parseArrayLiteral() {
    const elements = []
    const startToken = this.ensure('[')

    while (!this.is(']')) {
      elements.push(this.parseValue())

      if (!this.is(']')) {
        this.ensure(',')
      }
    }

    const endToken = this.ensure(']')

    return new ArrayLiteral(elements, startToken.start, endToken.end)
  }

  parse() {
    return {
      program: this.parseValue()
    }
  }
}


class BooleanLiteral {
  constructor(value, start, end) {
    this.type = 'BooleanLiteral'
    this.value = value
    this.start = start
    this.end = end
  }
}

class StringLiteral {
  constructor(value, start, end) {
    this.type = 'StringLiteral'
    this.value = value
    this.start = start
    this.end = end
  }
}

class NullLiteral {
  constructor(start, end) {
    this.type = 'NullLiteral'
    this.start = start
    this.end = end
  }
}

class NumericLiteral {
  constructor(value, start, end) {
    this.type = 'NumericLiteral'
    this.value = value
    this.start = start
    this.end = end
  }
}

class ArrayLiteral {
  constructor(elements, start, end) {
    this.type = 'ArrayLiteral'
    this.elements = elements
    this.start = start
    this.end = end
  }
}

class ObjectLiteral {
  constructor(properties, start, end) {
    this.type = 'ObjectLiteral'
    this.properties = properties
    this.start = start
    this.end = end
  }
}

class Property {
  constructor(key, value, start, end) {
    this.type = 'Property'
    this.key = key
    this.start = start
    this.end = end
  }
}

function parse(input) {
  return new Parser(input).parse()
}

module.exports = {
  parse,
}
