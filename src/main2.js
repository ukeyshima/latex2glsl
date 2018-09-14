const katex = require('katex');
const mathjs = require('mathjs');
const mathIntegral = require('mathjs-simple-integral');
const atl = require('asciimath-to-latex');

mathjs.import(mathIntegral);
let latex2js,
  radix,
  frac,
  pow,
  sin,
  cos,
  tan,
  leftright,
  naturalLog,
  log,
  sum,
  definiteIntegral,
  indefiniteIntegral,
  differential,
  limit,
  matrixParse,
  matrix,
  matrixMultiplication,
  matrixShape,
  shape,
  nextMulti;

radix = input => {
  return input.index
    ? `Math.pow(${shape(input.body)},1/${shape(input.index.body)})`
    : input.body.body[0].type === 'leftright'
      ? `Math.sqrt${shape(input.body.body)}`
      : `Math.sqrt(${shape(input.body.body)})`;
};

frac = input => {
  return `${shape(input.numer.body)}/${shape(input.denom.body)}`;
};

pow = input => {
  return `Math.pow(${
    input.base.type === 'leftright' ? shape(input.base.body) : shape(input.base)
    },${
    input.sup.body[0].type === 'leftright'
      ? shape(input.sup.body[0].body)
      : shape(input.sup.body)
    })`;
};

sin = input => {
  return input.type === 'leftright'
    ? `Math.sin${shape(input)}`
    : `Math.sin(${shape(input)})`;
};

cos = input => {
  return input.type === 'leftright'
    ? `Math.cos${shape(input)}`
    : `Math.cos(${shape(input)})`;
};

tan = input => {
  return input.type === 'leftright'
    ? `Math.tan${shape(input)}`
    : `Math.tan(${shape(input)})`;
};

leftright = input => {
  let left = '(';
  let right = ')';
  if (input.left === '[') {
    left = 'Math.floor(';
  }
  return `${left}${shape(input.body)}${right}`;
};

naturalLog = input => {
  return input.type === 'leftright'
    ? `Math.log${shape(input)}`
    : `Math.log(${shape(input)})`;
};

log = input => {
  const base = shape(input[0].sub.body);
  const expression = input[1];
  return expression.type === 'leftright'
    ? `Math.log${shape(expression)}/Math.log(${base})`
    : `Math.log(${shape(expression)})/Math.log(${base})`;
};

sum = input => {
  const expression = shape(input.slice(1, input.length));
  const start = shape(input[0].sub.body);
  const end = shape(input[0].sup.body);

  return `((() => {
        let result = 0;
        for(let ${start[0]}=${start.slice(2, start.length)};${
    start[0]
    }<${end};${start[0]}++){
            result += ${expression};
        }
        return result;
    })())`;
};

definiteIntegral = (input, deltaIndex) => {
  const start = shape(input[0].sub.body);
  const end = shape(input[0].sup.body);
  const expression = shape(input.slice(1, deltaIndex)).replace(/Math\./g, '');
  const val = shape(input[deltaIndex + 1]);
  return `((${val}=>{return ${latex2js(
    atl(mathjs.integral(expression, val).toString())
  )}})(${end})-(${val}=>{return ${latex2js(
    atl(mathjs.integral(expression, val).toString())
  )}})(${start}))`;
};

indefiniteIntegral = (input, deltaIndex) => {
  const expression = shape(input.slice(1, deltaIndex)).replace(/Math\./g, '');
  const val = shape(input[deltaIndex + 1]);
  return `(${latex2js(atl(mathjs.integral(expression, val).toString()))})`;
};

differential = input => {
  const expression = shape(input.base)
    .replace(/Math\./g, '')
    .replace(/pow\((.*)\,(.*)\)/g, '$1^$2');
  return mathjs.derivative(expression, 'x').toString();
};

limit = input => {
  const index = input[0].sub.body.findIndex(e => {
    return e.value === '\\rightarrow';
  });
  return `((${shape(input[0].sub.body.slice(0, index - 1))})=>${shape(
    input[1]
  )})(${shape(input[0].sub.body.slice(index, input[0].sub.body.length))})`;
};

matrixParse = input => {
  input = input.replace(/\\\\[\s\n]*(\w)/g, '\\ $1');
  return input;
};

matrix = input => {
  input =
    input.length === 1
      ? shape(input[0])
      : input.reduce((previousValue, currentValue) => {
        return shape(previousValue).match(/\[$/) ||
          currentValue.type === 'spacing'
          ? `${shape(previousValue)}${shape(currentValue)}`
          : `${shape(previousValue)},${shape(currentValue)}`;
      });
  return `[[${input}]]`;
};

matrixMultiplication = input => {
  input = input.map(i => {
    return typeof i === 'string'
      ? eval(i)
      : eval(matrix(i.body[0].body[0]).replace(/([a-zA-Z](\[\d\])?)/g, "'$1'"));
  });
  input =
    input[0][0].length === 1 && input[1][0].length === 1
      ? (input => {
        let result = '';
        input[0].forEach((e, i) => {
          result += `+${e}*${input[1][i]}`;
        });
        result = result.slice(1, result.length);
        return `(${result})`;
      })(input)
      : (input => {
        input = input.reduce((previousValue, currentValue) => {
          const o = [];
          previousValue.forEach((e, i) => {
            const q = [];
            e.forEach((f, j) => {
              let r = '';
              for (let k = 0; k < currentValue.length; k++) {
                r += `+${f}*${currentValue[k][i]}`;
              }
              r = r.slice(1, r.length);
              q.push(r);
            });
            o.push(q);
          });
          return o;
        });
        let result = '[';
        input.forEach(e => {
          result += '[';
          e.forEach(f => {
            result += f + ',';
          });
          result = result.slice(0, result.length - 1);
          result += '],';
        });
        result = result.slice(0, result.length - 1);
        result += ']';
        return result;
      })(input);
  return input;
};

matrixAddition = input => {
  input = input.map(i => {
    return typeof i === 'string'
      ? eval(i)
      : eval(matrix(i.body[0].body[0]).replace(/([a-zA-Z](\[\d\])?)/g, "'$1'"));
  });
  input = input.reduce((pre, cur) => {
    const o = [];
    pre.forEach((e, i) => {
      const q = [];
      e.forEach((f, j) => {
        let r = `${f}+${cur[i][j]}`;
        q.push(r);
      });
      o.push(q);
    });
    return o;
  });
  let result = '[';
  input.forEach(e => {
    result += '[';
    e.forEach(f => {
      result += f + ',';
    });
    result = result.slice(0, result.length - 1);
    result += '],';
  });
  result = result.slice(0, result.length - 1);
  result += ']';
  return result;
};

matrixSubtraction = input => {
  input = input.map(i => {
    return typeof i === 'string'
      ? eval(i)
      : eval(matrix(i.body[0].body[0]).replace(/([a-zA-Z](\[\d\])?)/g, "'$1'"));
  });
  input = input.reduce((pre, cur) => {
    const o = [];
    pre.forEach((e, i) => {
      const q = [];
      e.forEach((f, j) => {
        let r = `${f}-${cur[i][j]}`;
        q.push(r);
      });
      o.push(q);
    });
    return o;
  });
  let result = '[';
  input.forEach(e => {
    result += '[';
    e.forEach(f => {
      result += f + ',';
    });
    result = result.slice(0, result.length - 1);
    result += '],';
  });
  result = result.slice(0, result.length - 1);
  result += ']';
  return result;
};

matrixShape = input => {
  console.log(input);
  if (typeof input === 'string') return input;
  if (input.length === 1) return matrix(input[0].body[0].body[0]);
  let result;
  switch (input[1].type) {
    case 'leftright':
      result = matrixShape(
        matrixMultiplication(input.slice(0, 2)),
        input.slice(2, input.length)
      );
      break;
    case 'atom':
      switch (input[1].text) {
        case '+':
          result = matrixShape(
            matrixAddition([input[0], input[2]]),
            input.slice(3, input.length)
          );
          break;
        case '-':
          result = matrixShape(
            matrixAddition([input[0], input[2]]),
            input.slice(3, input.length)
          );
          break;
      }
      break;
  }
  return result;
};

nextMulti = (input, num) => {
  return input.length > num
    ? (input[num].type !== 'atom' &&
      input[num].type !== 'punct' &&
      input[num].type !== 'bin'
      ? '*'
      : '') + shape(input.slice(num, input.length))
    : ``;
};

shape = (prevText, next) => {
  let result;
  if (!Array.isArray(next)) {
    switch (typeof next) {
      case 'object':
        next = [next];
        break;
      case 'string':
        return next;
      default:
        break;
    }
  }
  switch (next[0].type) {
    case 'textord':
      result = `${
        ((prev.type !== 'textord' &&
          prev.type !== 'atom' &&
          prev.type !== 'bin' &&
          prev.type !== 'spacing')
          ? '*'
          : '') + shape(next[0], next.slice(1, next.length))}${next[0].text === '\\infty'
            ? Infinity
            : next[0].text}`;
      break;
    case 'mathord':
      result = `${next[0].text === '\\pi' ? `Math.PI` : next[0].text}${
        next.length > 1
          ? next[1].type === 'leftright' && next[1].left === '['
            ? `[${shape(next[1].body)}]${
            next.length > 2
              ? (next[2].type !== 'atom' &&
                next[2].type !== 'punct' &&
                next[2].type !== 'bin' &&
                next[2].type !== 'spacing' &&
                (next[2].type === 'leftright'
                  ? shape(next[2]).length !== 3 &&
                  !/\,/.test(shape(next[1])) &&
                  !next[2].left === '['
                  : true)
                ? `*`
                : ``) + shape(next.slice(2, next.length))
              : ``
            }`
            : (next[1].type !== 'atom' &&
              next[1].type !== 'punct' &&
              next[1].type !== 'bin' &&
              next[1].type !== 'spacing' &&
              (next[1].type === 'leftright'
                ? shape(next[1]).length !== 3 &&
                !/\,/.test(shape(next[1])) &&
                !next[1].left === '['
                : true)
              ? `*`
              : ``) + shape(next.slice(1, next.length))
          : ``
        }`;
      break;
    case 'spacing':
      result = `],[${
        next.length > 1 ? shape(next.slice(1, next.length)) : ''
        }`;
      break;
    case 'styling':
      result = shape(next[0].body);
      break;
    case 'atom':
      switch (next[0].text) {
        case '\\cdot':
          result = '*';
          break;
        default:
          result = next[0].text;
          break;
      }
      result += next.length > 1 ? shape(next.slice(1, next.length)) : ``;
      break;
    case 'punct':
      result = `${next[0].value}${
        next.length > 1 ? shape(next.slice(1, next.length)) : ``
        }`;
      break;
    case 'ordgroup':
      result = `${shape(next[0].body)}${nextMulti(next, 1)}`;
      break;
    case 'sqrt':
      result = `${radix(next[0])}${nextMulti(next, 1)}`;
      break;
    case 'leftright':
      result = `${
        next[0].body[0].type === 'array'
          ? next.length > 1
            ? matrixShape(next)
            : matrix(next[0].body[0].body[0])
          : `${leftright(next[0])}${nextMulti(next, 1)}`
        }`;
      break;
    case 'array':
      result = shape(next[0].body[0][0]);
      break;
    case 'genfrac':
      result = `${frac(next[0])}${nextMulti(next, 1)}`;
      break;
    case 'bin':
      switch (next[0].value) {
        case '\\cdot':
          result = `*${shape(next.slice(1, next.length))}`;
          break;
        default:
          result = `${next[0].value}${nextMulti(next, 1)}`;
          break;
      }
      break;
    case 'op':
      switch (next[0].name) {
        case '\\sin':
          result = `${sin(next[1])}${nextMulti(next, 2)}`;
          break;
        case '\\cos':
          result = `${cos(next[1])}${nextMulti(next, 2)}`;
          break;
        case '\\tan':
          result = `${tan(next[1])}${nextMulti(next, 2)}`;
          break;
        case '\\log':
          result = `${naturalLog(next[1])}${nextMulti(next, 2)}`;
          break;
        case '\\int':
          const deltaIndex = next.findIndex(e => {
            return e.type === 'mathord' && e.text === 'd';
          });
          result = `${indefiniteIntegral(next, deltaIndex)}${nextMulti(
            next,
            deltaIndex + 2
          )}`;
          break;
        default:
          break;
      }
      break;
    case 'supsub':
      if (next[0].sub) {
        switch (next[0].base.name) {
          case '\\log':
            result = `${log(next)}${nextMulti(next, 2)}`;
            break;
          case '\\sum':
            result = `${sum(next)}${nextMulti(next, 2)}`;
            break;
          case '\\int':
            const deltaIndex = next.findIndex(e => {
              return e.type === 'mathord' && e.text === 'd';
            });
            result = `${definiteIntegral(next, deltaIndex)}${nextMulti(
              next,
              deltaIndex + 2
            )}`;
            break;
          case '\\lim':
            result = `${limit(next)}${nextMulti(next, 2)}`;
            break;
          default:
            break;
        }
      } else {
        if (next[0].sup.body[0].text === '\\prime') {
          result = `${differential(next[0])}${nextMulti(next, 1)}`;
        } else {
          result = `${pow(next[0])}${nextMulti(next, 1)}`;
        }
      }
      break;
    default:
      result = `${next[0]}${nextMulti(next, 1)}`;
      break;
  }
  return result;
};

latex2js = input => {
  while (input.search(/\n/) >= 0) {
    input = input.replace(/\n/g, ' ');
  }
  input = matrixParse(input);
  const parseTree = katex.__parse(input);
  return shape(parseTree[0], parseTree.slice(1, parseTree.length));
};

console.log(latex2js(`\\begin{aligned}\\begin{pmatrix}
\\left[ x\\right]  \\
\\left[ y\\right] 
\\end{pmatrix}\\end{aligned}`))
// console.log(latex2js(`n-\\left[ n\\right] `));
// console.log(latex2js(`c\\left[ 0\\right] +2`));
// console.log(latex2js(`p\\left( 0\\right) +2`));
// console.log(
//   latex2js(
//     `\\begin{aligned}\\begin{pmatrix} a & 2\\ b & 1 \\end{pmatrix}+\\begin{pmatrix} c & 2 \\ d & 3\\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2js(`\\begin{aligned}\\begin{pmatrix}
// n & 0 & 2\\
// 0 & a & 8
// \\end{pmatrix}\\begin{pmatrix}
// 3 & b \\
// 0 & s \\
// 3 & 5
// \\end{pmatrix}\\begin{pmatrix}
// 2 & 0 \\
// f & 4
// \\end{pmatrix}\\end{aligned}`)
// );
// console.log(
//   latex2js(
//     `\\begin{aligned}\\begin{pmatrix} a\\left[ 0\\right]  \\ a\\left[ 1\\right]  \\end{pmatrix}\\begin{pmatrix} b\\left[ 0\\right]  \\ b\\left[ 1\\right]  \\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2js(
//     `\\begin{aligned}\\begin{pmatrix} a & 2\\ b & 1 \\end{pmatrix}+\\begin{pmatrix} c & 2 \\ d & 3\\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(latex2js('3^{4^{2}}'));
// console.log(
//   latex2js(`\\begin{aligned}\\begin{pmatrix}
// n & 0 & 2\\
// 0 & a & 8
// \\end{pmatrix}\\begin{pmatrix}
// 3 & b \\
// 0 & s \\
// 3 & 5
// \\end{pmatrix}\\begin{pmatrix}
// 2 & 0 \\
// f & 4
// \\end{pmatrix}\\end{aligned}`)
// );
// console.log(
//   latex2js(
//     `\\begin{aligned}\\begin{pmatrix} 1 \\ 0 \\end{pmatrix}\\begin{pmatrix} 3 & 2 \\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2js(
//     `\\begin{aligned}\\begin{pmatrix} 1 \\ v \\end{pmatrix}\\begin{pmatrix} r \\ 0 \\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2js(
//     '\\begin{aligned}5\\begin{pmatrix} 1 \\ 0 \\end{pmatrix}\\begin{pmatrix} x \\ y \\end{pmatrix}\\end{aligned}'
//   )
// );
// console.log(
//   latex2js(
//     `\\begin{aligned}\\sin \\left( \\begin{pmatrix} 3 \\ 4 \\end{pmatrix}\\begin{pmatrix} a \\ h \\end{pmatrix}\\right) \\cdot 64\\end{aligned}`
//   )
// );
// console.log(
//   eval(
//     latex2js('\\lim _{x\\rightarrow \\infty }\\left( \\dfrac {3}{x}\\right) ')
//   )
// );
// console.log(
//   eval(
//     latex2js('\\lim _{x\\rightarrow \\infty }\\left( \\dfrac {x}{2}\\right) ')
//   )
// );
// console.log(latex2js('3+3'));
// console.log(latex2js('x+y'));
// console.log(latex2js('3-2'));
// console.log(latex2js('x-y'));
// console.log(latex2js("\\left( \\log \\left( x\\right)\\right) '"));
// console.log(latex2js('\\int ^{3}_{2}5xdx'));
// console.log(latex2js('\\int 3x^{5}dx'));
// console.log(latex2js('\\int \\log \\left( x\\right) dx'));
// console.log(latex2js('\\sum ^{10}_{k=1}\\left( 3k^{3}\\right)'));
// console.log(latex2js('\\sum ^{10}_{k=1}p\\left( x,y\\right) '));
// console.log(latex2js('\\sum ^{10}_{k=1}p\\left( xy\\right) '));
// console.log(latex2js('\\sum ^{10}_{k=1}p\\left( x\\right) '));
// console.log(
//   latex2js(
//     '\\dfrac {\\sum ^{10}_{k=1}\\left( \\left( \\dfrac {1}{2}\\right) ^{k}p\\left( 2^{k}x,2^{k}y\\right) \\right) }{\\sum ^{10}_{k=1}\\left( \\dfrac {1}{2}\\right) ^{k}}'
//   )
// );
// console.log(latex2js('42^{3}'));
// console.log(latex2js('\\left( 42\\right) ^{\\left( 3\\right)}'));
// console.log(latex2js('\\sqrt {3}'));
// console.log(latex2js('\\dfrac {2}{3}'));
// console.log(latex2js('3^{2}'));
// console.log(latex2js('\\sqrt [3] {2}'));
// console.log(latex2js('\\sqrt {\\left( 3\\right) }'));
// console.log(latex2js('\\cos \\left( \\pi \\right)'));
// console.log(latex2js('\\log _{2}3'));
// console.log(latex2js('\\log _{2}\\left( 3^{2}\\right)'));
// console.log(latex2js('32xy'));
// console.log(latex2js('3x\\sqrt {y}'));
// console.log(latex2js('32x\\sqrt {2}'));
// console.log(latex2js('8\\sqrt {\\dfrac {42^{3}}{3}}'));
// console.log(latex2js('\\sum ^{10}_{k=1}\\left( 3k^{2}\\right) '));
