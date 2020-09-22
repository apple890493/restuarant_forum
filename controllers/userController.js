const bcrypt = require('bcryptjs')
const db = require('../models')
const imgur = require('imgur-node-api')
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID
const User = db.User
const Comment = db.Comment
const Restaurant = db.Restaurant
const Favorite = db.Favorite
const Like = db.Like
const Followship = db.Followship

const userController = {
  //註冊的頁面
  signUpPage: (req, res) => {
    return res.render('signup')
  },
  //處理註冊的行為,hash密碼是必需
  signUp: (req, res) => {
    if (req.body.passwordCheck !== req.body.password) {
      req.flash('error_messages', '兩次密碼輸入不同')
      return res.redirect('/signup')
    } else {
      User.findOne({ where: { email: req.body.email } }).then(user => {
        if (user) {
          req.flash('error_messages', '信箱重複！')
          return res.redirect('/signup')
        } else {
          User.create({
            name: req.body.name,
            email: req.body.email,
            password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10), null),
            image: 'https://i.imgur.com/Lq0dUBY.png'
          }).then(user => {
            req.flash('success_messages', '成功註冊帳號！')
            return res.redirect('/signin')
          })
        }
      })
    }
  },
  signInpage: (req, res) => {
    return res.render('signin')
  },
  signIn: (req, res) => {
    req.flash('success_messages', '登入成功!')
    res.redirect('/restaurants')
  },
  //登出機制
  logout: (req, res) => {
    req.flash('success_messages', '登出成功!')
    req.logout()
    res.redirect('/signin')
  },

  getUser: (req, res) => {
    return User.findByPk(req.params.id, {
      include: [
        { model: Comment, include: [Restaurant] },
        { model: Restaurant, as: 'FavoritedRestaurants' },
        { model: User, as: 'Followers' },
        { model: User, as: 'Followings' }
      ]
    })
      .then(user => {
        let comments = user.toJSON().Comments
        let favoritedRestaurants = user.toJSON().FavoritedRestaurants.length
        let followers = user.toJSON().Followers.length
        let followings = user.toJSON().Followings.length
        let replyNums = []
        comments.forEach(data => {
          restId = data.Restaurant.id
          if (!replyNums.includes(restId)) {
            replyNums.push(restId)
          }
        })
        const isFollowed = req.user.Followings.map(d => d.id).includes(user.id)
        // console.log(isFollowed)
        res.render('user/profile', {
          profile: user.toJSON(),
          userSelf: req.user,
          commentCount: replyNums.length,
          comments: comments,
          favoritedRestaurants: favoritedRestaurants,
          followers: followers,
          followings: followings,
          isFollowed: isFollowed
        })
      })
  },

  editUser: (req, res) => {
    return User.findByPk(req.params.id, {
      raw: true,
      nest: true
    })
      .then(user => {
        return res.render('user/editProfile', { user: user })
      })
  },
  putUser: (req, res) => {
    const { file } = req
    if (!req.body.name) {
      req.flash('error_messages', "name didn't exist.")
      return res.redirect('back')
    }

    if (file) {
      imgur.setClientID(IMGUR_CLIENT_ID)
      imgur.upload(file.path, (err, img) => {
        return User.findByPk(req.params.id)
          .then((user) => {
            user.update({
              name: req.body.name,
              image: file ? img.data.link : user.image,
            })
              .then((user) => {
                req.flash('success_messages', "User was successfully to update")
                res.redirect(`/users/${req.params.id}`)
              })
          })
      })
    } else {
      return User.findByPk(req.params.id)
        .then((user) => {
          user.update({
            name: req.body.name,
            image: user.image
          })
            .then((user) => {
              req.flash('success_messages', "User was successfully to update")
              res.redirect(`/users/${req.params.id}`)
            })
        })
    }
  },

  addFavorite: (req, res) => {
    return Favorite.create({
      UserId: req.user.id,
      RestaurantId: req.params.restaurantId
    })
      .then(restaruant => {
        return res.redirect('back')
      })
  },
  removeFavorite: (req, res) => {
    return Favorite.findOne({
      where: {
        UserId: req.user.id,
        RestaurantId: req.params.restaurantId
      }
    })
      .then(favorite => {
        favorite.destroy()
          .then(restaurant => {
            return res.redirect('back')
          })
      })
  },

  addLike: (req, res) => {
    return Like.create({
      UserId: req.user.id,
      RestaurantId: req.params.restaurantId
    })
      .then(restaruant => {
        return res.redirect('back')
      })
  },
  // removeLike: (req, res) => {
  //   return Like.findOne({
  //     where: {
  //       UserId: req.user.id,
  //       RestaurantId: req.params.restaurantId
  //     }
  //   })
  //     .then(like => {
  //       like.destroy()
  //         .then(restaurant => {
  //           return res.redirect('back')
  //         })
  //     })
  // },

  removeLike: (req, res) => {
    return Like.destroy({
      where: {
        UserId: req.user.id,
        RestaurantId: req.params.restaurantId
      }
    })
      .then((restaurant) => {
        return res.redirect('back')
      })
  },

  getTopUser: (req, res) => {
    return User.findAll({
      include: [
        { model: User, as: 'Followers' }
      ]
    })
      .then(users => {
        users = users.map(user => ({
          ...user.dataValues,
          //計算追蹤者人數
          FollowerCount: user.Followers.length,
          // 判斷目前登入使用者是否已追蹤該 User 物件
          isFollowed: req.user.Followings.map(d => d.id).includes(user.id)
        }))
        // 依追蹤者人數排序清單
        users = users.sort((a, b) => b.FollowerCount - a.FollowerCount)

        return res.render('topUser', {
          users: users,
        })
      })
  },
  addFollowing: (req, res) => {
    return Followship.create({
      followerId: req.user.id,
      followingId: req.params.userId
    })
      .then((followship) => {
        return res.redirect('back')
      })
  },
  removeFollowing: (req, res) => {
    return Followship.findOne({
      where: {
        followerId: req.user.id,
        followingId: req.params.userId
      }
    })
      .then((followship) => {
        followship.destroy()
          .then((followship) => {
            return res.redirect('back')
          })
      })
  }


}

module.exports = userController