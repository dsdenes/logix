const _ = require('lodash');
const Expression = require('./index');

test('static expression', () => {

  expect(Expression({ tree: Expression.deserialize(['some', [['eq', 1, 1]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['some', [['eq', 1, 2]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['some', [['eq', 1, 1], ['eq', 1, 2]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['every', [['eq', 1, 2]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1], ['eq', 1, 2]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['every', [['every', [['eq', 1, 1], ['eq', 1, 1]]]]]) }).evaluate()).toBe(true);
  expect(Expression({ tree: Expression.deserialize(['every', [['every', [['eq', 1, 1], ['eq', 1, 2]]]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['some', [['every', [['eq', 1, 1], ['eq', 1, 2]]]]]) }).evaluate()).toBe(false);
  expect(Expression({ tree: Expression.deserialize(['some', [['some', [['eq', 1, 1], ['eq', 1, 2]]]]]) }).evaluate()).toBe(true);

});

test('generated expressions', () => {

  const exp = Expression({ variables: {
    VAR1: [0, 0],
    VAR2: [0, 1],
    VAR3: [-100, 0],
    VAR4: [0, 2],
    VAR5: [0, 1000],
    VAR6: [0, 100],
    VAR7: [0, 100],
    VAR8: [0, 100],
    VAR9: [0, 100]
  }});

  for (let i = 0; i < 100; i++) {
    exp.mutate();
    exp.evaluate({
      VAR1: exp.getRandomValue('VAR1'),
      VAR2: exp.getRandomValue('VAR2'),
      VAR3: exp.getRandomValue('VAR3'),
      VAR4: exp.getRandomValue('VAR4'),
      VAR5: exp.getRandomValue('VAR5'),
      VAR6: exp.getRandomValue('VAR6'),
      VAR7: exp.getRandomValue('VAR7'),
      VAR8: exp.getRandomValue('VAR8'),
      VAR9: exp.getRandomValue('VAR9'),
    });
  }
});

test('serialization / deserialization', () => {

  const config = {
    variables: {
      VAR1: [0, 0],
      VAR2: [0, 1],
      VAR3: [-100, 0],
      VAR4: [0, 2],
      VAR5: [0, 1000],
      VAR6: [0, 100],
      VAR7: [0, 100],
      VAR8: [0, 100],
      VAR9: [0, 100]
    }
  };

  let expression = Expression(config);

  for (let i = 0; i < 100; i++) {

    const payload = {
      VAR1: expression.getRandomValue('VAR1'),
      VAR2: expression.getRandomValue('VAR2'),
      VAR3: expression.getRandomValue('VAR3'),
      VAR4: expression.getRandomValue('VAR4'),
      VAR5: expression.getRandomValue('VAR5'),
      VAR6: expression.getRandomValue('VAR6'),
      VAR7: expression.getRandomValue('VAR7'),
      VAR8: expression.getRandomValue('VAR8'),
      VAR9: expression.getRandomValue('VAR9'),
    };

    expression.mutate();

    const serialized = JSON.stringify(expression.serialize());
    config.tree = expression.deserialize(JSON.parse(serialized));
    let exp2 = Expression(config);
    expect(expression.evaluate(payload)).toEqual(exp2.evaluate(payload));
  }
});