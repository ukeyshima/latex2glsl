const katex = require('katex');
const mathjs = require('mathjs');
const mathIntegral = require('mathjs-simple-integral');
const atl = require('asciimath-to-latex');
const glsl = require('glsl-man');

const shader = `precision mediump float;
uniform mat4 invMatrix;
varying vec3 vPosition;
varying vec3 vNormal;
void main(void){
    vec3 color=vec3(1.0,0.0,1.0);    
    vec3 ambientColor=vec3(0.1);
    vec3 lightPosition=vec3(50.0,100.0,10.0);
    vec3 eyeDirection=vec3(0.0,0.0,1.0);
    vec3  lightVec  = lightPosition - vPosition;
    vec3  invLight  = normalize(invMatrix * vec4(lightVec, 0.0)).xyz;
    vec3  invEye    = normalize(invMatrix * vec4(eyeDirection, 0.0)).xyz;
    vec3  halfLE    = normalize(invLight + invEye);
    float diffuse   = clamp(dot(vNormal, invLight), 0.0, 1.0) + 0.2;
    float specular  = pow(clamp(dot(vNormal, halfLE), 0.0, 1.0), 30.0);
    color = color * vec3(diffuse) + vec3(specular) + ambientColor;    
    gl_FragColor=vec4(color,1.0);
}`;

console.log(glsl.parse(shader));

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl');

let resultCounter = 0;

mathjs.import(mathIntegral);
let latex2glsl,
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
  matrixShape,
  shape,
  nextMulti,
  int2dec,
  vecShape,
  dot,
  nextMatrixMulti;

int2dec = input => {
  input = input.replace(/(\d+)(?!\.|\d)/g, '$1.0');
  input = input.replace(/mat(\d)\.0/g, 'mat$1');
  input = input.replace(/vec(\d)\.0/g, 'vec$1');
  input = input.replace(/result(\d+)\.0/g, 'result$1');
  input = input.replace(/\[(\d+)\.0/g, '[$1');
  input = input.replace(/\.(\d+)\.0/g, '.$1');
  return input;
};

radix = input => {
  return input.index
    ? `pow(${shape(input.body)},1/${shape(input.index.body)})`
    : input.body.body[0].type === 'leftright'
      ? `sqrt${shape(input.body.body)}`
      : `sqrt(${shape(input.body.body)})`;
};

frac = input => {
  return `${shape(input.numer.body)}/${shape(input.denom.body)}`;
};

pow = input => {
  return `pow(${
    input.base.type === 'leftright' ? shape(input.base.body) : shape(input.base)
  },${
    input.sup.body[0].type === 'leftright'
      ? shape(input.sup.body[0].body)
      : shape(input.sup.body)
  })`;
};

sin = input => {
  return input.type === 'leftright'
    ? `sin${shape(input)}`
    : `sin(${shape(input)})`;
};

cos = input => {
  return input.type === 'leftright'
    ? `cos${shape(input)}`
    : `cos(${shape(input)})`;
};

tan = input => {
  return input.type === 'leftright'
    ? `tan${shape(input)}`
    : `tan(${shape(input)})`;
};

leftright = input => {
  let left = '(';
  let right = ')';
  if (input.left === '[') {
    left = 'floor(';
  }
  return `${left}${shape(input.body)}${right}`;
};

naturalLog = input => {
  return input.type === 'leftright'
    ? `log${shape(input)}`
    : `log(${shape(input)})`;
};

log = input => {
  const base = shape(input[0].sub.body);
  const expression = input[1];
  return expression.type === 'leftright'
    ? `log${shape(expression)}/log(${base})`
    : `log(${shape(expression)})/log(${base})`;
};

sum = input => {
  resultCounter++;
  const expression = shape(input.slice(1, input.length));
  const index = input[0].sub.body.findIndex(e => {
    return e.type === 'atom' && e.text === '=';
  });
  const startVari = shape(input[0].sub.body.slice(0, index));
  const startValu = shape(
    input[0].sub.body.slice(index + 1, input[0].sub.body.length)
  );
  const end = shape(input[0].sup.body);
  return `float result${resultCounter} = 0.0;
        for(float ${startVari}=${startValu};${startVari}<${end};${startVari}++){
            result${resultCounter} += ${expression};
        }`;
};

definiteIntegral = (input, deltaIndex) => {
  const start = shape(input[0].sub.body);
  const end = shape(input[0].sup.body);
  const expression = shape(input.slice(1, deltaIndex)).replace(/Math\./g, '');
  const val = shape(input[deltaIndex + 1]);
  return `((${val}=>{return ${latex2glsl(
    atl(mathjs.integral(expression, val).toString())
  )}})(${end})-(${val}=>{return ${latex2glsl(
    atl(mathjs.integral(expression, val).toString())
  )}})(${start}))`;
};

indefiniteIntegral = (input, deltaIndex) => {
  const expression = shape(input.slice(1, deltaIndex)).replace(/Math\./g, '');
  const val = shape(input[deltaIndex + 1]);
  return `(${latex2glsl(atl(mathjs.integral(expression, val).toString()))})`;
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
  input =
    input.split('],[').length === input.split(',').length
      ? `vec${input.split('],[').length}(${input.replace(/\]\,\[/g, ',')})`
      : `mat${input.split('],[').length}(${input.replace(/\]\,\[/g, ',')})`;
  return input;
};

dot = (input1, input2) => {
  if (input2.type === 'accent') {
    return `dot(${shape(input1.base)},${shape(input2.base)})`;
  } else {
    return `dot(${shape(input1.base)},${shape(input2)})`;
  }
};

vecShape = input => {
  let result;
  switch (input[0].type) {
    case 'accent':
      switch (input[0].label) {
        case '\\vec':
          result = `${
            input.length > 1
              ? input[1].type === 'atom' && input[1].text === '\\cdot'
                ? `${dot(input[0], input[2])}${nextMulti(input, 3)}`
                : `${shape(input[0].base)}${shape(
                    input.slice(1, input.length)
                  )}`
              : `${shape(input[0].base)}`
          }`;
          break;
        case '\\overlightarrow':
          result = shape(input[0].base);
          break;
        default:
          break;
      }
      break;
    case 'atom':
      switch (input[0].text) {
        case '\\cdot':
          break;
        default:
          break;
      }
    case 'leftright':
      result = `${
        input[0].body[0].type === 'array'
          ? input.length > 1
            ? matrixShape(input)
            : matrix(input[0].body[0].body[0])
          : `${leftright(input[0])}${nextMulti(input, 1)}`
      }`;
      break;
    default:
      break;
  }
  return result;
};

nextMatrixMulti = (input, num) => {
  return input.length > num
    ? (input[num].type !== 'atom' &&
      input[num].type !== 'punct' &&
      input[num].type !== 'bin' &&
      input[num].type !== 'spacing'
        ? '*'
        : '') + matrixShape(input.slice(num, input.length))
    : ``;
};

matrixShape = input => {
  let result;
  switch (input[0].type) {
    case 'leftright':
      result = (() => {
        return input.length > 1 &&
          matrix(input[0].body[0].body[0]).slice(0, 3) === 'vec' &&
          input[1].type === 'leftright' &&
          matrix(input[1].body[0].body[0]).slice(0, 3) === 'vec'
          ? `dot(${matrix(input[0].body[0].body[0])},${matrix(
              input[1].body[0].body[0]
            )})`
          : `${matrix(input[0].body[0].body[0])}${nextMatrixMulti(input, 1)}`;
      })();

      break;
    case 'atom':
      switch (input[0].text) {
        case '\\cdot':
          result = '*';
          break;
        default:
          result = input[0].text;
          break;
      }
      result += input.length > 1 ? shape(input.slice(1, input.length)) : ``;
      break;
  }
  return result;
};

nextMulti = (input, num) => {
  return input.length > num
    ? (input[num].type !== 'atom' &&
      input[num].type !== 'punct' &&
      input[num].type !== 'bin' &&
      input[num].type !== 'spacing'
        ? '*'
        : '') + shape(input.slice(num, input.length))
    : ``;
};

shape = input => {
  let result;
  if (!Array.isArray(input)) {
    switch (typeof input) {
      case 'object':
        input = [input];
        break;
      case 'string':
        return input;
      default:
        break;
    }
  }
  switch (input[0].type) {
    case 'textord':
      result = `${input[0].text === '\\infty' ? 99999999.99 : input[0].text}${
        input.length > 1
          ? (input[1].type !== 'textord' &&
            input[1].type !== 'atom' &&
            input[1].type !== 'bin' &&
            input[1].type !== 'spacing'
              ? '*'
              : '') + shape(input.slice(1, input.length))
          : ``
      }`;
      break;
    case 'mathord':
      result = `${
        input[0].text === '\\pi'
          ? `3.141592`
          : (() => {
              const nextExpression = `${
                input.length > 1
                  ? input[1].type === 'leftright' &&
                    input[1].left === '[' &&
                    input[1].right === ']'
                    ? (() => {
                        let index = input
                          .slice(1, input.length)
                          .findIndex(e => {
                            return !(
                              e.type === 'leftright' &&
                              e.left === '[' &&
                              e.right === ']'
                            );
                          });
                        index = index === -1 ? input.length - 1 : index;
                        const array = input.slice(2, index + 1);
                        array.unshift(`[${shape(input[1].body)}]`);
                        return `${array.reduce((pre, cur) => {
                          return pre + `[${shape(cur.body)}]`;
                        })}${
                          input.length > index + 1
                            ? (input[index + 1].type !== 'atom' &&
                              input[index + 1].type !== 'punct' &&
                              input[index + 1].type !== 'bin' &&
                              input[index + 1].type !== 'spacing' &&
                              (input[index + 1].type === 'leftright'
                                ? shape(input[index + 1]).length !== 3 &&
                                  !/\,/.test(shape(input[index])) &&
                                  !input[index + 1].left === '['
                                : true)
                                ? `*`
                                : ``) +
                              shape(input.slice(index + 1, input.length))
                            : ``
                        }`;
                      })()
                    : (input[1].type !== 'atom' &&
                      input[1].type !== 'punct' &&
                      input[1].type !== 'bin' &&
                      input[1].type !== 'spacing' &&
                      (input[1].type === 'leftright'
                        ? shape(input[1]).length !== 3 &&
                          !/\,/.test(shape(input[1])) &&
                          !input[1].left === '['
                        : true)
                        ? `*`
                        : ``) + shape(input.slice(1, input.length))
                  : ``
              }`;

              return input.length > 1 &&
                input[1].type === 'atom' &&
                input[1].text === '='
                ? (() => {
                    const shader = gl.createShader(gl.VERTEX_SHADER);
                    gl.shaderSource(
                      shader,
                      `void main(void) {
                        mat2 expression${int2dec(nextExpression)};}`
                    );
                    gl.compileShader(shader);
                    return `${
                      gl.getShaderParameter(shader, gl.COMPILE_STATUS)
                        ? 'float'
                        : (() => {
                            const splitText = gl
                              .getShaderInfoLog(shader)
                              .split("'");
                            const errorText = splitText[splitText.length - 4];
                            let result = '';
                            switch (errorText) {
                              case 'const float':
                                result = 'float';
                                break;
                              case 'const highp 2-component vector of float':
                                result = 'vec2';
                                break;
                              case 'const highp 3-component vector of float':
                                result = 'vec3';
                                break;
                              case 'const highp 4-component vector of float':
                                result = 'vec3';
                                break;
                              case 'const highp 2X2 matrix of float':
                                result = 'mat2';
                                break;
                              case 'const highp 3X3 matrix of float':
                                result = 'mat3';
                                break;
                              case 'const highp 4X4 matrix of float':
                                result = 'mat4';
                                break;
                              default:
                                result = 'float';
                                break;
                            }
                            return result;
                          })()
                    } ${input[0].text}${nextExpression}`;
                  })()
                : `${input[0].text}${nextExpression}`;
            })()
      }`;
      break;
    case 'spacing':
      result = `],[${
        input.length > 1 ? shape(input.slice(1, input.length)) : ''
      }`;
      break;
    case 'styling':
      result = shape(input[0].body);
      break;
    case 'atom':
      switch (input[0].text) {
        case '\\cdot':
          result = '*';
          break;
        default:
          result = input[0].text;
          break;
      }
      result += input.length > 1 ? shape(input.slice(1, input.length)) : ``;
      break;
    case 'punct':
      result = `${input[0].value}${
        input.length > 1 ? shape(input.slice(1, input.length)) : ``
      }`;
      break;
    case 'ordgroup':
      result = `${shape(input[0].body)}${nextMulti(input, 1)}`;
      break;
    case 'sqrt':
      result = `${radix(input[0])}${nextMulti(input, 1)}`;
      break;
    case 'accent':
      result = input[0].label === '\\vec' ? vecShape(input) : '';
      break;
    case 'leftright':
      result = `${
        input[0].body[0].type === 'array'
          ? input.length > 1
            ? matrixShape(input)
            : matrix(input[0].body[0].body[0])
          : `${leftright(input[0])}${nextMulti(input, 1)}`
      }`;
      break;
    case 'array':
      result = shape(input[0].body[0][0]);
      break;
    case 'genfrac':
      if (
        (input[0].numer.body[0].type === 'supsub' &&
          input[0].numer.body[0].base.name === '\\sum') ||
        (input[0].denom.body[0].type === 'supsub' &&
          input[0].denom.body[0].base.name === '\\sum')
      ) {
        const numerExpression =
          input[0].numer.body[0].type === 'supsub' &&
          input[0].numer.body[0].base.name === '\\sum'
            ? sum(input[0].numer.body)
            : (() => {
                resultCounter++;
                return `float result${resultCounter}=${shape(
                  input[0].numer.body
                )};`;
              })();
        const numerResult = `result${resultCounter}`;
        const denomExpression =
          input[0].denom.body[0].type === 'supsub' &&
          input[0].denom.body[0].base.name === '\\sum'
            ? sum(input[0].denom.body)
            : (() => {
                resultCounter++;
                return `float result${resultCounter}=${shape(
                  input[0].denom.body
                )};`;
              })();
        const denomResult = `result${resultCounter}`;
        resultCounter++;
        result = `${numerExpression}
        ${denomExpression}
        float result${resultCounter}=${numerResult}/${denomResult};
        `;
      } else {
        result = `${frac(input[0])}${nextMulti(input, 1)}`;
      }

      break;
    case 'bin':
      switch (input[0].value) {
        case '\\cdot':
          result = `*${shape(input.slice(1, input.length))}`;
          break;
        default:
          result = `${input[0].value}${nextMulti(input, 1)}`;
          break;
      }
      break;
    case 'op':
      switch (input[0].name) {
        case '\\sin':
          result = `${sin(input[1])}${nextMulti(input, 2)}`;
          break;
        case '\\cos':
          result = `${cos(input[1])}${nextMulti(input, 2)}`;
          break;
        case '\\tan':
          result = `${tan(input[1])}${nextMulti(input, 2)}`;
          break;
        case '\\log':
          result = `${naturalLog(input[1])}${nextMulti(input, 2)}`;
          break;
        case '\\int':
          const deltaIndex = input.findIndex(e => {
            return e.type === 'mathord' && e.text === 'd';
          });
          result = `${indefiniteIntegral(input, deltaIndex)}${nextMulti(
            input,
            deltaIndex + 2
          )}`;
          break;
        default:
          break;
      }
      break;
    case 'supsub':
      if (input[0].sub) {
        switch (input[0].base.name) {
          case '\\log':
            result = `${log(input)}${nextMulti(input, 2)}`;
            break;
          case '\\sum':
            result = sum(input);
            break;
          case '\\int':
            const deltaIndex = input.findIndex(e => {
              return e.type === 'mathord' && e.text === 'd';
            });
            result = `${definiteIntegral(input, deltaIndex)}${nextMulti(
              input,
              deltaIndex + 2
            )}`;
            break;
          case '\\lim':
            result = `${limit(input)}${nextMulti(input, 2)}`;
            break;
          default:
            const array = input[0].sub.body.find(e => {
              return e.type === 'textord';
            });
            result = `${shape(input[0].base)}${
              array
                ? (() => {
                    let elementIndex = `[${shape(input[0].sub.body)}]`;
                    elementIndex = elementIndex.replace(/,/g, '][');
                    return elementIndex + nextMulti(input, 1);
                  })()
                : (() => {
                    console.log(input);
                    const index = input[0].sub.body.slice(
                      1,
                      input[0].sub.body.length
                    );
                    index.unshift(`${input[0].sub.body[0].text}`);
                    return (
                      '.' +
                      index.reduce((prev, curr) => {
                        return prev + curr.text;
                      }) +
                      nextMulti(input, 1)
                    );
                  })()
            }`;
            break;
        }
      } else {
        if (input[0].sup.body[0].text === '\\prime') {
          result = `${differential(input[0])}${nextMulti(input, 1)}`;
        } else {
          result = `${pow(input[0])}${nextMulti(input, 1)}`;
        }
      }
      break;
    default:
      result = `${input[0]}${nextMulti(input, 1)}`;
      break;
  }
  return result;
};

export default (latex2glsl = input => {
  resultCounter = 0;
  while (input.search(/\n/) >= 0) {
    input = input.replace(/\n/g, ' ');
  }
  input = matrixParse(input);
  const parseTree = katex.__parse(input);
  return int2dec(shape(parseTree));
});

// console.log(latex2glsl(`x_{1,0,3,4}`));
// console.log(latex2glsl(`x_{10}`));
// console.log(latex2glsl(`p_{xy}`));
// console.log(
//   latex2glsl(`\\begin{aligned}\\begin{pmatrix}
// x & 2\\
// y & 1
// \\end{pmatrix}-\\begin{pmatrix}
// i\\left[ 0\\right] \\left[ 1\\right] \\left[ 2\\right] 3 & u\\left[ 0\\right] \\left[ 1\\right]  \\
// i\\left[ 0\\right] \\left[ 1\\right] & U\\left[ 0\\right] \\left[ 1\\right]
// \\end{pmatrix}\\end{aligned}`)
// );
// console.log(
//   latex2glsl(`\\begin{aligned}\\begin{pmatrix}
// 1 & 2 \\
// 0 & 0
// \\end{pmatrix}\\begin{pmatrix}
// 2 & 4 \\
// 5 & 3
// \\end{pmatrix}+\\begin{pmatrix}
// 1 & 2 \\
// 9 & 2
// \\end{pmatrix}\\end{aligned}`)
// );
// console.log(
//   latex2glsl(`\\begin{aligned}\\begin{pmatrix}
// 1.5 & i\\left[ 0\\right] & 0 & 3^{4^{2}} \\
// 0.9 & \\left[ n\\right] & 0 & 0 \\
// 0 & 0 & 1 & \\cos \\left( \\pi \\right) \\
// 0 & 0 & 0 & 1
// \\end{pmatrix}\\begin{pmatrix}
// 2 & 3 & 4 & v \\
// t & g & 3 & 2 \\
// 0 & a & 3 & 1 \\
// 5 & 2 & 2 & k
// \\end{pmatrix}\\begin{pmatrix}
// 4 & 2 & 4 & 8 \\
// 5 & 9 & h & 2 \\
// 6 & h & b & n \\
// k & g & a & x
// \\end{pmatrix}-\\begin{pmatrix}
// 4 & s & 4 & 8 \\
// 5 & r & h & 2 \\
// m & r & b & n \\
// b & t & a & 3
// \\end{pmatrix}\\end{aligned}`)
// );
// console.log(
//   latex2glsl(`\\begin{aligned}\\begin{pmatrix}
// \\left[ x\\right]  \\
// \\left[ y\\right]
// \\end{pmatrix}\\end{aligned}`)
// );
// console.log(latex2glsl(`n-\\left[ n\\right] `));
// console.log(latex2glsl(`c\\left[ 0\\right] +2`));
// console.log(latex2glsl(`p\\left( 0\\right) +2`));
// console.log(
//   latex2glsl(
//     `\\begin{aligned}\\begin{pmatrix} a & 2\\ b & 1 \\end{pmatrix}+\\begin{pmatrix} c & 2 \\ d & 3\\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2glsl(`\\begin{aligned}\\begin{pmatrix}
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
//   latex2glsl(
//     `\\begin{aligned}\\begin{pmatrix} a\\left[ 0\\right]  \\ a\\left[ 1\\right]  \\end{pmatrix}\\begin{pmatrix} b\\left[ 0\\right]  \\ b\\left[ 1\\right]  \\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2glsl(
//     `\\begin{aligned}\\begin{pmatrix} a & 2\\ b & 1 \\end{pmatrix}+\\begin{pmatrix} c & 2 \\ d & 3\\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(latex2glsl('3^{4^{2}}'));
// console.log(
//   latex2glsl(
//     `\\begin{aligned}\\begin{pmatrix} 1 \\ 0 \\end{pmatrix}\\begin{pmatrix} 3 & 2 \\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2glsl(
//     `\\begin{aligned}\\begin{pmatrix} 1 \\ v \\end{pmatrix}\\begin{pmatrix} r \\ 0 \\end{pmatrix}\\end{aligned}`
//   )
// );
// console.log(
//   latex2glsl(
//     '\\begin{aligned}5\\begin{pmatrix} 1 \\ 0 \\end{pmatrix}\\begin{pmatrix} x \\ y \\end{pmatrix}\\end{aligned}'
//   )
// );
// console.log(
//   latex2glsl(
//     `\\begin{aligned}\\sin \\left( \\begin{pmatrix} 3 \\ 4 \\end{pmatrix}\\begin{pmatrix} a \\ h \\end{pmatrix}\\right) \\cdot 64\\end{aligned}`
//   )
// );
// console.log(latex2glsl('3+3'));
// console.log(latex2glsl('x+y'));
// console.log(latex2glsl('3-2'));
// console.log(latex2glsl('x-y'));
// console.log(latex2glsl("\\left( \\log \\left( x\\right)\\right) '"));
// console.log(latex2glsl('42^{3}'));
// console.log(latex2glsl('\\left( 42\\right) ^{\\left( 3\\right)}'));
// console.log(latex2glsl('\\sqrt {3}'));
// console.log(latex2glsl('\\dfrac {2}{3}'));
// console.log(latex2glsl('3^{2}'));
// console.log(latex2glsl('\\sqrt [3] {2}'));
// console.log(latex2glsl('\\sqrt {\\left( 3\\right) }'));
// console.log(latex2glsl('\\cos \\left( \\pi \\right)'));
// console.log(latex2glsl('\\log _{2}3'));
// console.log(latex2glsl('\\log _{2}\\left( 3^{2}\\right)'));
// console.log(latex2glsl('32xy'));
// console.log(latex2glsl('3x\\sqrt {y}'));
// console.log(latex2glsl('32x\\sqrt {2}'));
// console.log(latex2glsl('8\\sqrt {\\dfrac {42^{3}}{3}}'));

console.log(latex2glsl(`y=2`));
console.log(latex2glsl(`y=\\sqrt {\\dfrac {3^{5}}{2}}`));
console.log(
  latex2glsl(`y=\\begin{aligned}\\begin{pmatrix}
1.5 & 2 & 0 & 3^{4^{2}} \\
0.9 & \\left[ n\\right] & 0 & 0 \\
0 & 0 & 1 & \\cos \\left( \\pi \\right) \\
0 & 0 & 0 & 1
\\end{pmatrix}\\begin{pmatrix}
2 & 3 & 4 & v \\
t & g & 3 & 2 \\
0 & a & 3 & 1 \\
5 & 2 & 2 & k
\\end{pmatrix}\\begin{pmatrix}
4 & 2 & 4 & 8 \\
5 & 9 & h & 2 \\
6 & h & b & n \\
k & g & a & x
\\end{pmatrix}-\\begin{pmatrix}
4 & s & 4 & 8 \\
5 & r & h & 2 \\
m & r & b & n \\
b & t & a & 3
\\end{pmatrix}\\end{aligned}`)
);
console.log(
  latex2glsl(`y=\\begin{aligned}\\begin{pmatrix}
1.5 & 2  & 3^{4^{2}} \\
\\left[ n\\right] & 0 & 0 \\
0 & 0 &  \\cos \\left( \\pi \\right)
\\end{pmatrix}\\end{aligned}`)
);
console.log(
  latex2glsl(`y=\\begin{aligned}\\begin{pmatrix}
1.5  \\
\\left[ n\\right] \\
\\cos \\left( \\pi \\right) 
\\end{pmatrix}\\end{aligned}`)
);
// console.log(
//   latex2glsl('\\lim _{x\\rightarrow \\infty }\\left( \\dfrac {3}{x}\\right) ')
// );
// console.log(
//   latex2glsl('\\lim _{x\\rightarrow \\infty }\\left( \\dfrac {x}{2}\\right) ')
// );
// console.log(latex2glsl('\\int ^{3}_{2}5xdx'));
// console.log(latex2glsl('\\int 3x^{5}dx'));
// console.log(latex2glsl('\\int \\log \\left( x\\right) dx'));
// console.log(latex2glsl('\\sum ^{10}_{k=1}\\left( 3k^{3}\\right)'));
// console.log(latex2glsl('\\sum ^{10}_{k=1}p\\left( x,y\\right) '));
// console.log(latex2glsl('\\sum ^{10}_{k=1}p\\left( xy\\right) '));
// console.log(latex2glsl('\\sum ^{10}_{k=1}p\\left( x\\right) '));
// console.log(
//   latex2glsl(
//     '\\dfrac {\\sum ^{7}_{k=1}\\left( \\left( \\dfrac {1}{2}\\right) ^{k}h\\left( 2^{k}p_{x},2^{k}p_{y}\\right) \\right) }{\\sum ^{10}_{k=1}\\left( \\dfrac {1}{2}\\right) ^{k}}'
//   )
// );
// console.log(
//   latex2glsl(
//     '\\dfrac {\\sum ^{10}_{k=1}\\left( \\left( \\dfrac {1}{2}\\right) ^{k}p\\left( 2^{k}x,2^{k}y\\right) \\right) }{\\cos \\left( \\pi \\right)}'
//   )
// );
// console.log(latex2glsl('\\sum ^{10}_{k=1}\\left( 3k^{2}\\right) '));
