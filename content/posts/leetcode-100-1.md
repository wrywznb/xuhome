---
title: "LeetCode-热题100-1"
date: 2026-11-10
tags: ["LeetCode-热题100"]
summary: "leetcode第一题-两数之和-哈希表方法"
---

# 给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出 和为目标值 target  的那 两个 整数，并返回它们的数组下标。 你可以假设每种输入只会对应一个答案，并且你不能使用两次相同的元素。 你可以按任意顺序返回答案。
例如：
输入：nums = [2,7,11,15], target = 9
输出：[0,1]
解释：因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 
# 答案1：（暴力）


![image](/images/20261110-155901-image.png)



# 答案2：（哈希表）


![image](/images/20261110-155950-image.png)



# 要点解析：
# 1.enumerate 在遍历可迭代对象时，同时给出"下标"和"元素值"
适用于列表、元组、字符串、字典、集合、range
```
nums = [2, 7, 11, 15]
for i, num in enumerate(nums):
    print(i, num)
输出：0 2
      1 7
      2 11
      3 15
```python
# 2.函数
```
raw = input("请输入 nums：")      # "2 7 11 15"
parts = raw.split()               # ["2","7","11","15"]
nums = list(map(int, parts))      # [2,7,11,15]
```
input：输入的一定是字符串 例如2 7 1 15
split（）：按照空格切分
split（","）：按照逗号切分
map（int，x）：转化格式为int
list（）：转化为真正的列表
# 3.list
空列表
```
a = list()              # []
```
从其他可迭代对象转换
```
b = list("abc")         # ['a', 'b', 'c']      字符串→字符列表
c = list((1, 2, 3))     # [1, 2, 3]            元组→列表
d = list(range(5))      # [0, 1, 2, 3, 4]      range→列表
e = list(map(int, ["1","2"]))  # [1, 2]        前面讲过的写法
```
用range生成列表
```
list(range(5))          # [0, 1, 2, 3, 4]
list(range(1, 6))       # [1, 2, 3, 4, 5]
list(range(0, 10, 2))   # [0, 2, 4, 6, 8]     步长 2
list(range(10, 0, -1))  # [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]  倒序
```
# 4.sorted
```
sorted(iterable, key=None, reverse=False)
```
返回的一定是list列表
默认升序
```
nums = [3, 1, 4, 1, 5, 9, 2]
result = sorted(nums)
print(result)      # [1, 1, 2, 3, 4, 5, 9]
print(nums)        # [3, 1, 4, 1, 5, 9, 2]  原列表不变
```
降序
```
nums = [3, 1, 4, 1, 5]
print(sorted(nums, reverse=True))   # [5, 4, 3, 1, 1]
```
key=abs-关键值排序 
key=len-字符串长度排序

sorted（）和.sort()对比
```
list.sort(key=None, reverse=False)
```
```
nums = [3, 1, 2]
new = sorted(nums)      # 返回新列表
print(new)              # [1, 2, 3]
print(nums)             # [3, 1, 2]  没变
```
```
nums.sort()             # 原地排序
print(nums)             # [1, 2, 3]
```
