function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (call && (typeof call === "object" || typeof call === "function")) { return call; } if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');

var traverse = require('traverse');

var util = require('util');

var assert = require('assert');

var CantMutateError =
/*#__PURE__*/
function (_Error) {
  _inherits(CantMutateError, _Error);

  function CantMutateError() {
    _classCallCheck(this, CantMutateError);

    return _possibleConstructorReturn(this, (CantMutateError.__proto__ || Object.getPrototypeOf(CantMutateError)).apply(this, arguments));
  }

  return CantMutateError;
}(Error);

function every() {
  return _.every.apply(null, arguments);
}

function some() {
  return _.some.apply(null, arguments);
}

var logics = {
  every,
  some
};

function eq() {
  return _.eq.apply(null, arguments);
}

function gt() {
  return _.gt.apply(null, arguments);
}

function lt() {
  return _.lt.apply(null, arguments);
}

function gte() {
  return _.gte.apply(null, arguments);
}

function lte() {
  return _.lte.apply(null, arguments);
}

var operators = {
  eq,
  gt,
  lt,
  gte,
  lte
};

function Expression() {
  var _config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  _config = _.defaults(_config, {
    tree: [every, []],
    variables: {}
  });
  assert(isGroupNode(_config.tree), 'The root level of the given tree has to be a logical group.');
  var variables = Object.assign({}, _config.variables);
  var tree = traverse(_config.tree);
  return {
    config,
    evaluate,
    mutate,
    getPath,
    print,
    setRandomTree,
    getRandomValue,
    getVariable,
    serialize,
    deserialize
  };

  function config() {
    return _config;
  }

  function serialize() {
    var node = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getPath([]);

    if (isGroupNode(node)) {
      var logic = getLogicFromGroup(node);
      var expressions = getExpressionsFromGroup(node);
      return [logic.name, expressions.map(serialize)];
    } else {
      return node.map(function (nodeItem) {
        if (_.isFunction(nodeItem)) {
          return nodeItem.name;
        } else if (nodeItem.__wrapped) {
          return {
            __wrapped: true,
            name: nodeItem.name
          };
        } else {
          return nodeItem;
        }
      });
    }
  }

  function print() {
    console.log(util.inspect(getPath([]), false, null));
  }

  function evaluate() {
    var payload = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var node = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : getPath([]);

    if (isGroupNode(node)) {
      var logic = getLogicFromGroup(node);
      var expressions = getExpressionsFromGroup(node);
      var results = expressions.map(function (expression) {
        return evaluate(payload, expression);
      });
      return logic(results);
    } else {
      return evaluateExpression(node, payload);
    }
  }

  function evaluateExpression(expression, payload) {
    // console.log('EVALUATE', util.inspect(expression, false, null));
    var operator = getOperatorFromExpression(expression);

    var expressionValues = _.tail(expression).map(function (value) {
      return getValue(value, payload);
    });

    return operator.apply(null, expressionValues);
  }

  function mutate() {
    var rand = _.random(true);

    try {
      if (_.inRange(rand, 0, 0.10)) {
        addRandomExpression();
      } else if (_.inRange(rand, 0.10, 0.20)) {
        removeRandomExpression();
      } else {
        mutateRandomExpression();
      }
    } catch (err) {
      if (err instanceof CantMutateError) {
        mutate();
      } else {
        throw err;
      }
    }
  }

  function getPath(path) {
    // traverse returns by reference
    return _.cloneDeep(tree.get(path));
  }

  function setPath(path, payload) {
    tree.set(path, payload);
  }

  function mutateRandomExpression() {
    var expressionPathArray = getRandomOneSideWrappedVariableExpressionPath();

    if (!_.isArray(expressionPathArray) || !expressionPathArray.length) {
      throw new CantMutateError();
    }

    var expression = getPath(expressionPathArray);
    var payload = getOneSideExpressionPayload(expression);
    var variableName = getOneSideExpressionVariableName(expression);
    var newPayload;

    while ((newPayload = modifyByRandomPercent(payload)) && !isValidVariablePayload(variableName, newPayload)) {
      ;
    }

    expression = setOneSideExpressionPayload(expression, newPayload);
    setExpressionAtExpressionPath(expressionPathArray, expression);
  }

  function removeRandomExpression() {
    var expressionGroupPath = getRandomGroupPath();
    var expressionGroup = getPath(expressionGroupPath);
    var expressions = getExpressionsFromGroup(expressionGroup);

    if (expressions.length > 1) {
      var expression = _.sample(expressions);

      removeExpressionAtGroupPath(expressionGroupPath, expression);
    }
  }

  function addRandomExpression() {
    var randomGroupLevelPath = getRandomGroupPath();
    var expression = getRandomExpression();
    return addExpressionAtGroupPath(randomGroupLevelPath, expression);
  }

  function addExpressionAtGroupPath(expressionGroupPath, expression) {
    var expressionGroup = getPath(expressionGroupPath);
    var expressions = getExpressionsFromGroup(expressionGroup);
    expressions.push(expression);
    setExpressionsAtGroupPath(expressionGroupPath, expressions);
  }

  function removeExpressionAtGroupPath(expressionGroupPath, expression) {
    var expressionGroup = getPath(expressionGroupPath);
    var expressions = getExpressionsFromGroup(expressionGroup);

    _.pull(expressions, expression);

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
    expression[2] = payload;
    return expression;
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

  function setExpressionAtExpressionPath(path, expressions) {
    setPath(path, expressions);
  }

  function getRandomOneSideWrappedVariableExpressionPath() {
    var expressionPaths = [];
    tree.map(function () {
      var node = getPath(this.path);

      if (isOneSideWrappedVariableExpression(node)) {
        expressionPaths.push(this.path);
      }
    });
    return _.sample(expressionPaths);
  }

  function getRandomGroupPath() {
    var groupPaths = [];
    tree.map(function () {
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
    var node = getPath(path);
    return path === [] || isGroupNode(node);
  }

  function getRandomValue(variableName) {
    return _.random(getVariableLowerBound(variableName), getVariableUpperBound(variableName), true);
  }

  function modifyByRandomPercent(value) {
    var maxPercent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 10;

    var percent = _.random(0, maxPercent, true);

    var share = value * (percent / 100);
    return _.random() ? value + share : value - share;
  }

  function getVariableLowerBound(variableName) {
    return variables[variableName][0];
  }

  function getVariableUpperBound(variableName) {
    return variables[variableName][1];
  }

  function setRandomTree() {
    tree = traverse([every, [getRandomExpression()]]);
  }

  function getRandomExpression() {
    var expr;
    var availableVariableBounds = Object.keys(variables);
    assert(availableVariableBounds.length, 'There should be at least one variable defined.');

    var rand = _.random(true); // Variable expression


    if (_.inRange(rand, 0, 0.8)) {
      expr = [];
      expr.push(_.sample(Object.values(operators)));

      var firstVariableName = _.sample(availableVariableBounds);

      expr.push(getVariable(firstVariableName));

      _.pull(availableVariableBounds, firstVariableName); // Both sides are variables


      if (_.random() && availableVariableBounds.length > 0) {
        var secondVariableName = _.sample(availableVariableBounds);

        expr.push(getVariable(secondVariableName)); // One side is static
      } else {
        expr.push(getRandomValue(firstVariableName));
      } // Expression group

    } else {
      expr = [_.sample(Object.values(logics)), [getRandomExpression()]];
    }

    return expr;
  }
}

function deserialize(node) {
  if (isSerializedGroupNode(node)) {
    var logic = getLogicFromSerializedGroup(node);
    var expressions = getExpressionsFromSerializedGroup(node);
    return [logic, expressions.map(deserialize)];
  } else {
    return node.map(function (nodeItem) {
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
  var tmpNode = _.defaultsDeep(node);

  tmpNode[1] = expressions;
  return tmpNode;
}

function getVariable(name) {
  return {
    __wrapped: true,
    name,
    get: function get(payload) {
      return payload[name];
    }
  };
}

function crossover() {
  var groupNodes = _.flatten(Array.from(arguments));

  var config = _.cloneDeep(groupNodes[0].config());

  var groupNode1 = groupNodes[0].getPath([]);
  var groupNode2 = groupNodes[1].getPath([]);
  var expressions1 = getExpressionsFromGroup(groupNode1);
  var expressions2 = getExpressionsFromGroup(groupNode2);
  var basisGroupNode = _.random() ? groupNode1 : groupNode2;
  var longerExpressions;
  var mixinExpressions;
  var crossoverPoint1;
  var crossoverPoint2;
  var offspringExpressions;

  if (expressions1.length === 1 && expressions2.length === 1) {
    offspringExpressions = [expressions1[0], expressions2[0]];
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

  return Expression(Object.assign({}, config, {
    tree: setExpressionsAtGroupNode(basisGroupNode, offspringExpressions)
  }));
}

function mixExpressions(expressions, mixinExpressions, from, to) {
  return _.concat(_.slice(expressions, 0, from), _.slice(mixinExpressions, from, to), _.slice(expressions, to));
}

Expression.deserialize = deserialize;
Expression.crossover = crossover;
module.exports = Expression;