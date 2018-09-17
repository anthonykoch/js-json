
import test from 'ava'

const { parse } = require('./index')

test('object', t => {
	t.is(parse('{}').program.type, 'ObjectLiteral')
	t.is(parse('{"cool": []}').program.properties[0].key.value, '"cool"')
	t.is(parse('{1: []}').program.properties[0].key.value, '1')
});

test('array', t => {
  t.is(parse('[]').program.type, 'ArrayLiteral')
  t.is(parse('[1,{}]').program.elements[0].type, 'NumericLiteral')
  t.is(parse('[1,{}]').program.elements[1].type, 'ObjectLiteral')
});

test('number', t => {
  t.is(parse('123').program.value, '123')
  t.is(parse('123.456').program.value, '123.456')
  t.is(parse('123.456e+9').program.value, '123.456e+9')
  t.is(parse('.456').program.value, '.456')
  t.is(parse('.456e+9').program.value, '.456e+9')
});

test('string', t => {
  t.is(parse('""').program.value, '""')
  t.is(parse('"\\\n"').program.value, '"\\\n"')

  t.throws(() => parse('"\n"'))
});

test('null', t => {
  t.is(parse('null').program.type, 'NullLiteral')
});

test('boolean', t => {
  t.is(parse('true').program.value, 'true')
  t.is(parse('false').program.value, 'false')
});
