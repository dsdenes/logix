const _ = require('lodash');
const traverse = require('traverse');
const util = require('util');
const assert = require('assert');
const WeightedPicker = require('weighted-picker').default;

class CantMutateError extends Error {}
let retryMutate = 0;

function every() { return  _.every.apply(null, arguments); }
function some() { return  _.some.apply(null, arguments); }

const logics = {
  every,
  some,
};

function eq() { return  _.eq.apply(null, arguments); }
function gt() { return  _.gt.apply(null, arguments); }
function lt() { return  _.lt.apply(null, arguments); }
function gte() { return  _.gte.apply(null, arguments); }
function lte() { return  _.lte.apply(null, arguments); }

const operators = {
  eq,
  gt,
  lt,
  gte,
  lte
};

function Expression(_config = {}) {

  _.defaultsDeep(_config, {
    tree: [every, []],
    variables: {},
    mutateMinPercent: 0.05,
    mutateMaxPercent: 0.15,
  });

  assert(isGroupNode(_config.tree), 'The root level of the given tree has to be a logical group.');

  const variables = _.cloneDeep(_config.variables);

  let tree = traverse(_config.tree);

  return {
    config,
    evaluate,
    mutate,
    mutateRandomExpression,
    removeRandomExpression,
    addRandomExpression,
    getPath,
    print,
    setRandomTree,
    getRandomValue,
    getVariable,
    getVariableDecimals,
    hasBounds,
    modifyByRandomPercent,
    serialize,
    deserialize
  };

  function config() {
    return _config;
  }

  function serialize(node = getPath([])) {
    if (isGroupNode(node)) {
      const logic = getLogicFromGroup(node);
      const expressions = getExpressionsFromGroup(node);
      return [logic.name, expressions.map(serialize)];
    } else {
      return node.map(nodeItem => {
        if (_.isFunction(nodeItem)) {
          return nodeItem.name;
        } else if (nodeItem.__wrapped) {
          return { __wrapped: true, name: nodeItem.name };
        } else {
          return nodeItem;
        }
      });
    }
  }

  function print() {
    console.log(util.inspect(getPath([]), false, null));
  }

  function evaluate(payload = {}, node = getPath([])) {
    if (isGroupNode(node)) {
      const logic = getLogicFromGroup(node);
      const expressions = getExpressionsFromGroup(node);
      const results = expressions.map(expression => evaluate(payload, expression));
      return logic(results);
    } else {
      return evaluateExpression(node, payload);
    }
  }

  function evaluateExpression(expression, payload) {
    const operator = getOperatorFromExpression(expression);
    const expressionValues = _.tail(expression).map(value => getValue(value, payload));
    return operator.apply(null, expressionValues);
  }

  function mutate(_config = {}) {

    _config = Object.assign({
      add: 1,
      remove: 1,
      mutate: 8,
    }, _config);

    const weights = Object.values(_config);

    const possibleMutations = [
      addRandomExpression,
      removeRandomExpression,
      mutateRandomExpression
    ];

    const picker = new WeightedPicker(3, index => weights[index]);
    const chosenMutation = possibleMutations[picker.pickOne()];

    try {
      chosenMutation();
      retryMutate = 0;
    } catch (err) {
      if (err instanceof CantMutateError) {
        if (retryMutate++ > 50) {
          throw err;
        }
        mutate();
      } else {
        throw err;
      }
    }
  }

  function getPath(path) {
    // reference
    return tree.get(path);
  }

  function setPath(path, payload) {
    tree.set(path, payload);
  }

  function mutateRandomExpression() {
    let expressionPathArray = getRandomOneSideWrappedVariableExpressionPath();
    if (!_.isArray(expressionPathArray) || !expressionPathArray.length) {
      throw new CantMutateError();
    }
    // reference
    let expression = getPath(expressionPathArray);
    let payload = getOneSideExpressionPayload(expression);
    const variableName = getOneSideExpressionVariableName(expression);
    const newPayload = modifyByRandomPercent(variableName, payload);
    setOneSideExpressionPayload(expression, newPayload);
  }

  function removeRandomExpression() {
    const expressionGroupPath = getRandomGroupPath();
    const expressionGroup = getPath(expressionGroupPath);
    const expressions = getExpressionsFromGroup(expressionGroup);
    if (expressions.length > 1) {
      const expression = _.sample(expressions);
      _.pull(expressions, expression);
      setExpressionsAtGroupPath(expressionGroupPath, expressions);
    }
  }

  function addRandomExpression() {
    const randomGroupLevelPath = getRandomGroupPath();
    const expression = getRandomExpression();
    return addExpressionAtGroupPath(randomGroupLevelPath, expression);
  }

  function addExpressionAtGroupPath(expressionGroupPath, expression) {
    const expressionGroup = getPath(expressionGroupPath);
    const expressions = getExpressionsFromGroup(expressionGroup);
    expressions.push(expression);
    setExpressionsAtGroupPath(expressionGroupPath, expressions);
  }

  function isOneSideWrappedVariableExpression(expression) {
    return isExpression(expression) && isWrappedVariable(expression[1]) && isStaticValue(expression[2]);
  }

  function isValidVariablePayload(variableName, payload) {
    return _.clamp(payload, getVariableLowerBound(variableName), getVariableUpperBound(variableName)) === payload;
  }

  function getOneSideExpressionVariableName(expression) {
    return expression[1].name;
  }

  function getOneSideExpressionPayload(expression) {
    return expression[2];
  }

  function setOneSideExpressionPayload(expression, payload) {
    // reference
    expression[2] = payload;
  }

  function getOperatorFromExpression(expression) {
    return expression[0];
  }

  function getValue(expressionValue, payload) {
    if (isWrappedVariable(expressionValue)) {
      return expressionValue.get(payload);
    } else if (_.isFunction(expressionValue)) {
      return expressionValue(payload);
    } else {
      return expressionValue;
    }
  }

  function isWrappedVariable(expressionValue) {
    return Boolean(expressionValue.__wrapped);
  }

  function isStaticValue(expressionValue) {
    return Number.isFinite(expressionValue);
  }

  function setExpressionsAtGroupPath(path, expressions) {
    path.push([1]);
    setPath(path, expressions);
  }

  function getRandomOneSideWrappedVariableExpressionPath() {
    const expressionPaths = [];
    tree.map(function() {
      const node = getPath(this.path);
      if (isOneSideWrappedVariableExpression(node)) {
        expressionPaths.push(this.path);
      }
    });
    return _.sample(expressionPaths);
  }

  function getRandomGroupPath() {
    const groupPaths = [];
    tree.map(function() {
      if (isGroupTreeNode(this)) {
        groupPaths.push(this.path);
      }
    });
    return _.sample(groupPaths);
  }

  function isExpression(expression) {
    return Array.isArray(expression) && Object.values(operators).includes(expression[0]);
  }

  function isGroupTreeNode(node) {
    return node.isRoot || isGroupPath(node.path);
  }

  function isGroupNode(node) {
    // console.log(Object.values(logics).includes(node[0]), Object.values(logics), node[0]);
    return Array.isArray(node) && Object.values(logics).includes(node[0]);
  }

  function isGroupPath(path) {
    const node = getPath(path);
    return path === [] || isGroupNode(node);
  }

  function getRandomValue(variableName) {
    const decimals = getVariableDecimals(variableName);
    const lowerBound = getVariableLowerBound(variableName);
    const upperBound = getVariableUpperBound(variableName);
    assert(lowerBound !== undefined && upperBound !== undefined, `${variableName} doesn't have lower or upper bound set.`);
    return _.round(_.random(getVariableLowerBound(variableName), getVariableUpperBound(variableName), true), decimals);
  }

  function getVariableDecimals(variableName) {
    if (variables[variableName].decimals !== undefined) {
      assert(_.isNumber(variables[variableName].decimals), 'Decimals has to be a number');
      return variables[variableName].decimals;
    }
    const lowerBound = getVariableLowerBound(variableName);
    const upperBound = getVariableUpperBound(variableName);
    const boundDifference = upperBound - lowerBound;
    return _.max([0, 8 - String(_.round(boundDifference * 10000)).length]);
  }

  function modifyByRandomPercent(variableName, value) {
    const modifyPercent = _.random(_config.mutateMinPercent, _config.mutateMaxPercent, true);
    const decimals = getVariableDecimals(variableName);
    const lowerBound = getVariableLowerBound(variableName);
    const upperBound = getVariableUpperBound(variableName);

    if (lowerBound === upperBound) {
      return value;
    }

    const boundsDifference = upperBound - lowerBound;
    let resultValue;
    if (_.random() && upperBound !== value) {
      const modifyValue = _.min([boundsDifference * modifyPercent, upperBound - value]);
      resultValue = value + modifyValue;
    } else {
      const modifyValue = _.min([boundsDifference * modifyPercent, value - lowerBound]);
      resultValue = value - modifyValue;
    }
    return _.round(resultValue, decimals);
  }

  function hasBounds(variableName) {
    return getVariableLowerBound(variableName) !== undefined && getVariableUpperBound(variableName) !== undefined;
  }

  function canCompare(variableName) {
    const variableCompareList = getVariableCompareList(variableName);
    return variableCompareList && variableCompareList.length > 0;
  }

  function getVariableCompareList(variableName) {
    if (variables[variableName].compare !== undefined) {
      assert(_.isArray(variables[variableName].compare), 'Compare list has to be array.');
    }
    return variables[variableName].compare;
  }

  function getVariableLowerBound(variableName) {
    const lowerBound = variables[variableName].lowerBound;
    if (lowerBound !== undefined) {
      assert(_.isNumber(lowerBound));
    }
    return lowerBound;
  }

  function getVariableUpperBound(variableName) {
    const upperBound = variables[variableName].upperBound;
    if (upperBound !== undefined) {
      assert(_.isNumber(upperBound));
    }
    return upperBound;
  }

  function setRandomTree() {
    tree = traverse([every, [getRandomExpression()]]);
  }

  function getRandomExpression(noGroup = false) {
    let expr;
    const variableNames = Object.keys(variables);
    assert(variableNames.length, 'There should be at least one variable defined.');

    const variablesWithBounds = _.filter(variableNames, hasBounds);
    const variablesToCompare = _.filter(variableNames, canCompare);
    assert(variablesWithBounds.length !== 0 || variablesToCompare.length !== 0, `There are not enough properly configured variables.`);

    const rand = _.random(true);

    // Variable expression
    if (_.inRange(rand, 0, 0.8) || noGroup) {
      expr = [];
      expr.push(_.sample(Object.values(operators)));

      // Variable within bounds
      if (variablesToCompare.length === 0 || (_.random() && variablesWithBounds.length)) {
        const firstVariableName = _.sample(variablesWithBounds);
        expr.push(getVariable(firstVariableName));
        _.pull(variablesWithBounds, firstVariableName);
        expr.push(getRandomValue(firstVariableName));

      // Compare to other variable
      } else {
        const firstVariableName = _.sample(variablesWithBounds);
        expr.push(getVariable(firstVariableName));
        const canCompareToVariables = getVariableCompareList(firstVariableName);
        const secondVariableName = _.sample(canCompareToVariables);
        expr.push(getVariable(secondVariableName));
      }

    // Expression group
    } else {
      expr = [_.sample(Object.values(logics)), [getRandomExpression(true)]];
    }

    return expr;
  }
}

function deserialize(node) {
  if (isSerializedGroupNode(node)) {
    const logic = getLogicFromSerializedGroup(node);
    const expressions = getExpressionsFromSerializedGroup(node);
    return [logic, expressions.map(deserialize)];
  } else {
    return node.map(nodeItem => {
      if (nodeItem in operators) {
        return operators[nodeItem];
      } else if (nodeItem.__wrapped) {
        return getVariable(nodeItem.name);
      } else {
        return nodeItem;
      }
    });
  }
}

function isSerializedGroupNode(node) {
  return Array.isArray(node) && node[0] in logics;
}

function getLogicFromGroup(group) {
  return group[0];
}

function getExpressionsFromGroup(group) {
  return group[1];
}

function getLogicFromSerializedGroup(group) {
  return logics[group[0]];
}

function getExpressionsFromSerializedGroup(group) {
  return group[1];
}

function setExpressionsAtGroupNode(node, expressions) {
  node[1] = expressions;
}

function getVariable(name) {
  return {
    __wrapped: true,
    name,
    get: payload => payload[name],
  }
}

function crossover(groupExpression1, groupExpression2, _config = {}) {

  const expressionConfig = _.clone(groupExpression1.config());
  const groupNode1 = _.cloneDeep(groupExpression1.getPath([]));
  const groupNode2 = _.cloneDeep(groupExpression2.getPath([]));
  const expressions1 = getExpressionsFromGroup(groupNode1);
  const expressions2 = getExpressionsFromGroup(groupNode2);
  let basisGroupNode = _.random() ? groupNode1 : groupNode2;

  let longerExpressions;
  let mixinExpressions;
  let crossoverPoint1;
  let crossoverPoint2;
  let offspringExpressions;

  _config = Object.assign({
    singleExpressionsConcat: 1,
    singleExpressionsRandom: 1
  }, _config);

  if (expressions1.length === 1 && expressions2.length === 1) {

    const weights = Object.values(_config);
    const singleExpressionsPicker = new WeightedPicker(2, index => weights[index]);

    const possibleOffspringExpressions = [
      [expressions1[0], expressions2[0]],
      [_.sample([expressions1[0], expressions2[0]])]
    ];

    offspringExpressions = possibleOffspringExpressions[singleExpressionsPicker.pickOne()];

  } else {
    if (expressions1.length > expressions2.length) {
      longerExpressions = expressions1;
      mixinExpressions = expressions2;

      crossoverPoint1 = _.random(expressions1.length);
      crossoverPoint2 = _.random(expressions1.length - crossoverPoint1) + crossoverPoint1;

    } else {
      longerExpressions = expressions2;
      mixinExpressions = expressions1;

      crossoverPoint1 = _.random(expressions2.length);
      crossoverPoint2 = _.random(expressions2.length - crossoverPoint1) + crossoverPoint1;
    }

    offspringExpressions = mixExpressions(longerExpressions, mixinExpressions, crossoverPoint1, crossoverPoint2);
  }

  setExpressionsAtGroupNode(basisGroupNode, offspringExpressions);

  return Expression(Object.assign(
      {},
      expressionConfig,
      { tree: basisGroupNode }
    ));
}

function mixExpressions(expressions, mixinExpressions, from, to) {
  return _.concat(
    _.slice(expressions, 0, from),
    _.slice(mixinExpressions, from, to),
    _.slice(expressions, to),
  );
}

Expression.deserialize = deserialize;
Expression.crossover = crossover;

module.exports = Expression;
