const Expression = require('./index');
const assert = require('assert');
const _ = require('lodash');

const variables = {
  VAR1: {
    lowerBound: 0,
    upperBound: 0,
  },
  VAR2: {
    lowerBound: 0,
    upperBound: 1
  },
  VAR3: {
    lowerBound: -100,
    upperBound: 0
  },
  VAR4: {
    lowerBound: 0,
    upperBound: 2
  },
  VAR5: {
    lowerBound: 0,
    upperBound: 1000
  },
  VAR6: {
    lowerBound: 0,
    upperBound: 100
  },
  VAR7: {
    compare: []
  },
  VAR8: {
    compare: ['VAR7']
  },
  VAR9: {
    compare: ['VAR8', 'VAR7']
  },
};

test(`Pass objects by reference for the sake of speed`, () => {
  const expression = Expression({ tree: Expression.deserialize(['some', [['eq', 1, 1]]]) });
  const rootPathValue = expression.getPath([]);
  rootPathValue[1][0][1] = 2;
  expect(expression.getPath([1,0,1])).toBe(2);
});

test(`Mutate random expression`, () => {
  const expression = Expression({ tree: Expression.deserialize(['every', [['eq', { __wrapped: true, name: 'VAR5' }, 1]]]), variables });
  expect(expression.getPath([1,0,2])).toBe(1);
  expression.mutateRandomExpression();
  expect(expression.getPath([1,0,2])).not.toBe(1);
});

test(`Remove random expression`, () => {
  const expression = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1],['eq', 1, 2]]]), variables });
  expect(expression.getPath([1])).toHaveLength(2);
  expect(expression.getPath([1,0,2])).toBe(1);
  expect(expression.getPath([1,1,2])).toBe(2);
  expression.removeRandomExpression();
  expect(expression.getPath([1])).toHaveLength(1);
  expect(expression.getPath([1,0,1])).toBe(1);
});

test(`Add random expression`, () => {
  const expression = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]), variables });
  expect(expression.getPath([1])).toHaveLength(1);
  expect(expression.getPath([1,0,1])).toBe(1);
  expect(expression.getPath([1,0,2])).toBe(1);
  expression.addRandomExpression();
  expect(expression.getPath([1])).toHaveLength(2);
});

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

  const expression = Expression({ variables });

  expression.setRandomTree();

  for (let i = 0; i < 100; i++) {
    expression.mutate();
    expression.evaluate({
      VAR1: expression.getRandomValue('VAR1'),
      VAR2: expression.getRandomValue('VAR2'),
      VAR3: expression.getRandomValue('VAR3'),
      VAR4: expression.getRandomValue('VAR4'),
      VAR5: expression.getRandomValue('VAR5'),
      VAR6: expression.getRandomValue('VAR6'),
    });
  }
});

test('serialization / deserialization', () => {

  const config = {
    variables
  };

  let expression = Expression(config);
  expression.setRandomTree();

  for (let i = 0; i < 100; i++) {

    const payload = {
      VAR1: expression.getRandomValue('VAR1'),
      VAR2: expression.getRandomValue('VAR2'),
      VAR3: expression.getRandomValue('VAR3'),
      VAR4: expression.getRandomValue('VAR4'),
      VAR5: expression.getRandomValue('VAR5'),
      VAR6: expression.getRandomValue('VAR6'),
    };

    expression.mutate();

    const serialized = JSON.stringify(expression.serialize());
    config.tree = expression.deserialize(JSON.parse(serialized));
    let exp2 = Expression(config);
    expect(expression.evaluate(payload)).toEqual(exp2.evaluate(payload));
  }
});

test('crossover, concat', () => {

  const expression1 = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]), variables });
  const expression2 = Expression({ tree: Expression.deserialize(['every', [['gt', 2, 1]]]), variables });

  const offspring = Expression.crossover(expression1, expression2, { singleExpressionsRandom: 0, singleExpressionsConcat: 1 });
  offspring.mutate({ add: 1, remove: 0, mutate: 0 });

  expect(expression1.getPath([1])).toHaveLength(1);
  expect(expression1.getPath([1,0,1])).toBe(1);
  expect(expression1.getPath([1,0,2])).toBe(1);

  expect(expression2.getPath([1])).toHaveLength(1);
  expect(expression2.getPath([1,0,1])).toBe(2);
  expect(expression2.getPath([1,0,2])).toBe(1);

  expect(offspring.getPath([1])).toHaveLength(3);
  expect(offspring.getPath([1,0,1])).toBe(1);
  expect(offspring.getPath([1,1,1])).toBe(2);

});

test('crossover, random', () => {

  const expression1 = Expression({ tree: Expression.deserialize(['every', [['eq', 1, 1]]]), variables });
  const expression2 = Expression({ tree: Expression.deserialize(['every', [['gt', 2, 1]]]), variables });

  const offspring = Expression.crossover(expression1, expression2, { singleExpressionsRandom: 1, singleExpressionsConcat: 0 });
  offspring.mutate({ add: 1, remove: 0, mutate: 0 });

  expect(expression1.getPath([1])).toHaveLength(1);
  expect(expression1.getPath([1,0,1])).toBe(1);
  expect(expression1.getPath([1,0,2])).toBe(1);

  expect(expression2.getPath([1])).toHaveLength(1);
  expect(expression2.getPath([1,0,1])).toBe(2);
  expect(expression2.getPath([1,0,2])).toBe(1);

  expect(offspring.getPath([1])).toHaveLength(2);
  expect(offspring.getPath([1,0,2])).toBe(1);

});

test('getVariableDecimals', () => {
  const expression = Expression({ variables: {
    ADX30: {
      lowerBound: 0,
      upperBound: 66.2250
    },
    ADX50: {
      lowerBound: 0,
      upperBound: 75.0768
    },
    RSI14: {
      lowerBound: 0,
      upperBound: 93.8693
    },
    BBANDSU: {
      lowerBound: 1.047578578615194,
      upperBound: 1.210693062112635
    },
    BBANDSM: {
      lowerBound: 1.0469255714285708,
      upperBound: 1.210349761904763
    },
    BBANDSL: {
      lowerBound: 1.0456893947159194,
      upperBound: 1.210103289526245
    },
    DEMA: {
      lowerBound: 1.0468246337377913,
      upperBound: 1.2102661612297378
    },
    MACD: {
      lowerBound: -0.004368756239813143,
      upperBound: 0.004310827468728018
    },
    MACDSignal: {
      lowerBound: -0.0034490735313215614,
      upperBound: 0.0034621316849092745
    }
  }});

  expect(expression.getVariableDecimals('ADX30')).toBe(2);
  expect(expression.getVariableDecimals('ADX50')).toBe(2);
  expect(expression.getVariableDecimals('RSI14')).toBe(2);
  expect(expression.getVariableDecimals('BBANDSU')).toBe(4);
  expect(expression.getVariableDecimals('BBANDSM')).toBe(4);
  expect(expression.getVariableDecimals('BBANDSL')).toBe(4);
  expect(expression.getVariableDecimals('DEMA')).toBe(4);
  expect(expression.getVariableDecimals('MACD')).toBe(6);
  expect(expression.getVariableDecimals('MACDSignal')).toBe(6);
});

test('modifyByRandomPercent', () => {
  const expression = Expression({ variables });
  for (let i = 0; i < 100; i++) {
    const variableNames = Object.keys(variables);
    const variablesWithBounds = _.filter(variableNames, expression.hasBounds);
    const variableName = _.sample(variablesWithBounds);
    const initialValue = expression.getRandomValue(variableName);
    const lowerBound = variables[variableName].lowerBound;
    const upperBound = variables[variableName].upperBound;
    const modifiedValue = expression.modifyByRandomPercent(variableName, initialValue);
    assert(_.clamp(modifiedValue, lowerBound, upperBound) === modifiedValue);
  }
});