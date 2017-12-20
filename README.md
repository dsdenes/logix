# Install
```bash
$ npm install expression
```

# Usage
```javascript
const Expression = require('expression');
const _ = require('lodash');

const exp = Expression({
  tree: Expression.deserialize(['every', [
    ['eq', 1, 1],
    ['gt', 2, 1],
    ['gt', Expression.getVariable('var1'), 1],    
  ]])
});

const result = exp.evaluate({
  var1: 2
}); 
console.log(result); // true

```

## Mutate
```javascript
const exp = expression({
  variables: {
    var1: [0, 100],
    var2: [0, 100],
  }
});

exp.setRandomTree();

exp.mutate();
exp.mutate();
exp.mutate();

exp.print();

exp.evaluate({
  var1: 10,
  var2: 20
});