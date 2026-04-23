(module
  (import "env" "str_new" (func $str_new (param i32) (param i32) (result i32)))
  (import "env" "str_concat" (func $str_concat (param i32) (param i32) (result i32)))
  (import "env" "str_eq" (func $str_eq (param i32) (param i32) (result i32)))
  (memory (export "memory") 1)
  (global $heap_ptr (mut i32) (i32.const 4096))
  (global $free_head (mut i32) (i32.const 0))
  (func $__ensure_capacity (param $needed_end i32)
  (local $current_bytes i32) (local $required_pages i32)
    memory.size
    i32.const 65536
    i32.mul
    local.set $current_bytes
    local.get $needed_end
    local.get $current_bytes
    i32.gt_u
    if
      local.get $needed_end
      i32.const 65535
      i32.add
      i32.const 65536
      i32.div_u
      local.set $required_pages
      local.get $required_pages
      memory.size
      i32.sub
      memory.grow
      drop
    end
  )
  (func $alloc (param $size i32) (result i32)
  (local $aligned i32) (local $block i32) (local $prev i32) (local $curr i32) (local $curr_size i32) (local $next i32) (local $needed_end i32)
    local.get $size
    i32.const 7
    i32.add
    i32.const -8
    i32.and
    local.set $aligned
    local.get $aligned
    i32.eqz
    if
      i32.const 8
      local.set $aligned
    end
    i32.const 0
    local.set $prev
    global.get $free_head
    local.set $curr
    (block $search_done
      (loop $search
        local.get $curr
        i32.eqz
        br_if $search_done
        local.get $curr
        i32.load
        local.set $curr_size
        local.get $curr_size
        local.get $aligned
        i32.ge_u
        if
          local.get $curr
          i32.const 4
          i32.add
          i32.load
          local.set $next
          local.get $prev
          i32.eqz
          if
            local.get $next
            global.set $free_head
          else
            local.get $prev
            i32.const 4
            i32.add
            local.get $next
            i32.store
          end
          local.get $curr
          i32.const 8
          i32.add
          return
        end
        local.get $curr
        local.set $prev
        local.get $curr
        i32.const 4
        i32.add
        i32.load
        local.set $curr
        br $search
      )
    )
    global.get $heap_ptr
    local.set $block
    local.get $block
    i32.const 8
    i32.add
    local.get $aligned
    i32.add
    local.set $needed_end
    local.get $needed_end
    call $__ensure_capacity
    local.get $block
    local.get $aligned
    i32.store
    local.get $block
    i32.const 4
    i32.add
    i32.const 0
    i32.store
    local.get $needed_end
    global.set $heap_ptr
    local.get $block
    i32.const 8
    i32.add
  )
  (func $free (param $ptr i32)
  (local $block i32)
    local.get $ptr
    i32.eqz
    if
      return
    end
    local.get $ptr
    i32.const 8
    i32.sub
    local.set $block
    local.get $block
    i32.const 4
    i32.add
    global.get $free_head
    i32.store
    local.get $block
    global.set $free_head
  )
  ;; Struct User
  ;; Total size: 4 bytes
  (func $User_new (param $name i32) (result i32)
  (local $__struct_ptr i32)
    i32.const 4
    call $alloc
    local.set $__struct_ptr
    local.get $__struct_ptr
    local.get $name
    i32.store
    local.get $__struct_ptr
  )
  ;;   field name: offset 0, size 4, align 4
  (func $main (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32) (local $u i32)
    i32.const 32
    i32.const 1
    call $str_new
    call $User_new
    local.set $u
    local.get $u
    call $Printable_User_print
    i32.const 34
    i32.const 3
    call $str_new
    call $str_eq
    if
      i32.const 1
      return
    else
      i32.const 0
      return
    end
    i32.const 0
    return
  )
  (func $Printable_User_print (param $self i32) (result i32)
  (local $__enum_tmp i32) (local $__tmp_i32 i32) (local $__tmp_i32_b i32) (local $__slice_obj i32) (local $__slice_start i32) (local $__slice_end i32) (local $__slice_count i32) (local $__slice_result i32) (local $__slice_idx i32)
    i32.const 38
    i32.const 2
    call $str_new
    local.get $self
    i32.load
    call $str_concat
    return
  )
  (export "main" (func $main))
  (export "__alloc" (func $alloc))
  (export "__free" (func $free))
  (data (i32.const 32) "\41") ;; "A"
  (data (i32.const 34) "\55\3a\41") ;; "U:A"
  (data (i32.const 38) "\55\3a") ;; "U:"
)
